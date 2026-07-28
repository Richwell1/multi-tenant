-- ===========================================================================
-- Lifecycle Monitoring: record install / update / rollback.
--
-- `package_lifecycle_operations` declares nine operations but only six were
-- ever written (disable, enable, uninstall, restore, permanent_removal, purge).
-- install / update / rollback happened in the release + marketplace flows,
-- which recorded only into `package_installations`, so Platform Admin's
-- Lifecycle Monitoring silently omitted a third of its own vocabulary.
--
-- TRANSACTION SEMANTICS
-- A failure cannot be logged from inside the transaction it aborts — the log
-- row rolls back with everything else, and Postgres has no autonomous
-- transactions. So each RPC now separates two phases:
--
--   1. Pre-flight validation (authorization, state, dependency, version).
--      Still RAISES, exactly as before. The operation never started, so it
--      earns no monitoring record, and every existing caller/UI error path is
--      preserved unchanged.
--   2. Apply phase (entitlement + installation writes). Wrapped in a block
--      that opens a `running` record, marks it `completed` on success, and on
--      failure lets the block roll back — taking the `running` row with it —
--      then writes a fresh `failed` record with a SAFE category and returns a
--      failure result rather than raising.
--
-- That yields the guarantees asked for: atomic package changes, no `completed`
-- record for a rolled-back operation, no orphaned `running` rows, and a durable
-- failure record. Callers detect failure via `status` in the returned JSON.
--
-- No authorization, RLS, entitlement, or tenant-isolation change: every
-- function keeps its original SECURITY DEFINER + self-authorization checks.
-- ===========================================================================

-- --- Duplicate suppression ---------------------------------------------------
-- correlation_id already defaults to a fresh uuid, so existing rows are unique.
-- Making it unique lets a caller pass an explicit key and be sure a retried
-- request cannot double-log the same logical operation.
create unique index if not exists package_lifecycle_operations_correlation_key
  on public.package_lifecycle_operations (correlation_id);

-- --- Safe failure categories -------------------------------------------------
-- Maps an internal signal to a stable, non-sensitive category. Anything
-- unrecognized collapses to 'operation_failed' so raw Postgres text (table
-- names, constraint names, tenant values) can never reach the log or the UI.
create or replace function public.lifecycle_failure_category(p_sqlstate text, p_sqlerrm text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_sqlerrm in (
      'not_authorized', 'not_marketplace_package', 'already_installed',
      'no_installable_version', 'dependency_not_met', 'company_not_active',
      'package_inactive', 'base_package_not_enabled', 'base_version_too_low',
      'not_installable', 'installation_not_found', 'installation_not_processable',
      'not_installed', 'not_disabled'
    ) then p_sqlerrm
    when p_sqlstate = '42501' then 'not_authorized'
    else 'operation_failed'
  end;
$$;

-- --- Log helpers -------------------------------------------------------------
-- Opens a `running` record. The partial unique index
-- (company_id, package_key) where status='running' remains the concurrency
-- guard: a second concurrent operation on the same package raises here.
create or replace function public.lifecycle_op_start(
  p_company uuid,
  p_package_key text,
  p_operation public.lifecycle_operation,
  p_source_version text default null,
  p_target_version text default null,
  p_correlation uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.package_lifecycle_operations
    (company_id, package_key, operation, status, source_version, target_version, correlation_id)
  values (p_company, p_package_key, p_operation, 'running', p_source_version, p_target_version,
          coalesce(p_correlation, gen_random_uuid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.lifecycle_op_complete(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.package_lifecycle_operations
     set status = 'completed', completed_at = now()
   where id = p_id;
$$;

-- Writes a terminal `failed` record. Called from an exception handler AFTER the
-- protected block rolled back, so it is a fresh insert, not an update.
create or replace function public.lifecycle_op_failed(
  p_company uuid,
  p_package_key text,
  p_operation public.lifecycle_operation,
  p_source_version text,
  p_target_version text,
  p_reason text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.package_lifecycle_operations
    (company_id, package_key, operation, status, source_version, target_version,
     failure_reason, completed_at)
  values (p_company, p_package_key, p_operation, 'failed', p_source_version, p_target_version,
          p_reason, now());
$$;

-- Internal helpers only: never callable directly by a browser client.
revoke execute on function public.lifecycle_failure_category(text, text) from public, anon, authenticated;
revoke execute on function public.lifecycle_op_start(uuid, text, public.lifecycle_operation, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.lifecycle_op_complete(uuid) from public, anon, authenticated;
revoke execute on function public.lifecycle_op_failed(uuid, text, public.lifecycle_operation, text, text, text)
  from public, anon, authenticated;

-- ===========================================================================
-- install_marketplace_extension — company installs an optional extension.
-- Unchanged validation/authorization; adds install-vs-update logging.
-- ===========================================================================
create or replace function public.install_marketplace_extension(p_package_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_version text;
  v_base text;
  v_install uuid;
  v_prior text;
  v_op public.lifecycle_operation;
  v_log uuid;
begin
  -- ---- Phase 1: validation (raises; no monitoring record) ----
  select m.company_id into v_company
  from public.company_memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = v_uid and m.status = 'active' and m.role = 'company_admin' and c.status = 'active'
  limit 1;
  if v_company is null then raise exception 'not_authorized' using errcode = '42501'; end if;

  if not exists (select 1 from public.packages where key = p_package_key and is_active and category = 'marketplace_extension') then
    raise exception 'not_marketplace_package' using errcode = '42501';
  end if;

  if exists (select 1 from public.company_packages where company_id = v_company and package_key = p_package_key and enabled) then
    raise exception 'already_installed' using errcode = 'P0001';
  end if;

  select pv.version into v_version
  from public.package_versions pv
  where pv.package_key = p_package_key and pv.released_at is not null and pv.diagnostic_status = 'PASS'
    and public.valid_semver(pv.version)
  order by string_to_array(regexp_replace(pv.version, '[-+].*$', ''), '.')::int[] desc
  limit 1;
  if v_version is null then raise exception 'no_installable_version' using errcode = 'P0001'; end if;

  select base_package_key into v_base from public.packages where key = p_package_key;
  if v_base is not null and not exists (
    select 1 from public.company_packages where company_id = v_company and package_key = v_base and enabled
  ) then
    raise exception 'dependency_not_met' using errcode = 'P0001';
  end if;

  -- A retained/disabled entitlement at an older version makes this an update.
  select package_version into v_prior
  from public.company_packages where company_id = v_company and package_key = p_package_key;
  v_op := case when v_prior is null then 'install' else 'update' end;

  -- ---- Phase 2: apply (logged; rolls back atomically on failure) ----
  begin
    v_log := public.lifecycle_op_start(v_company, p_package_key, v_op, v_prior, v_version);

    insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source)
    values (v_company, p_package_key, v_version, true, 'installed', now(), 'company_marketplace')
    on conflict (company_id, package_key) do update
      set package_version = excluded.package_version, enabled = true, status = 'installed',
          activated_at = now(), installation_source = 'company_marketplace', updated_at = now();

    insert into public.package_installations
      (release_id, company_id, package_key, version, status, started_at, completed_at, attempt_count, last_attempt_at)
    values (null, v_company, p_package_key, v_version, 'installed', now(), now(), 1, now())
    returning id into v_install;

    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_company, v_uid, 'marketplace.installed', 'package_installation', v_install,
            jsonb_build_object('package', p_package_key, 'version', v_version, 'source', 'company_marketplace'));

    perform public.lifecycle_op_complete(v_log);

    return jsonb_build_object('package_key', p_package_key, 'version', v_version, 'company_id', v_company,
                              'installed_version', v_version, 'installation_source', 'company_marketplace',
                              'status', 'installed', 'operation_id', v_log);
  exception when others then
    perform public.lifecycle_op_failed(v_company, p_package_key, v_op, v_prior, v_version,
                                       public.lifecycle_failure_category(sqlstate, sqlerrm));
    return jsonb_build_object('package_key', p_package_key, 'company_id', v_company, 'status', 'failed',
                              'error', public.lifecycle_failure_category(sqlstate, sqlerrm));
  end;
end;
$$;

-- ===========================================================================
-- install_company_update — company applies an assigned/pushed update.
-- ===========================================================================
create or replace function public.install_company_update(p_installation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_status public.installation_status;
  v_key text;
  v_version text;
  v_base text;
  v_min_base text;
  v_category public.package_category;
  v_source public.install_source;
  v_prior text;
  v_op public.lifecycle_operation;
  v_log uuid;
begin
  -- ---- Phase 1: validation (raises; no monitoring record) ----
  select pi.company_id, pi.status, pi.package_key, pi.version
    into v_company, v_status, v_key, v_version
  from public.package_installations pi
  where pi.id = p_installation_id;
  if v_company is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.company_memberships m
    join public.companies c on c.id = m.company_id
    where m.company_id = v_company and m.user_id = v_uid
      and m.status = 'active' and m.role = 'company_admin' and c.status = 'active'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_status not in ('pending', 'failed') then
    raise exception 'not_installable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.packages where key = v_key and is_active) then
    raise exception 'package_inactive' using errcode = 'P0001';
  end if;

  select base_package_key, min_base_version, category
    into v_base, v_min_base, v_category
  from public.packages where key = v_key;

  if v_base is not null then
    if not exists (select 1 from public.company_packages where company_id = v_company and package_key = v_base and enabled) then
      raise exception 'base_package_not_enabled' using errcode = 'P0001';
    end if;
    if v_min_base is not null and not exists (
      select 1 from public.company_packages
      where company_id = v_company and package_key = v_base and enabled
        and public.valid_semver(package_version)
        and string_to_array(regexp_replace(package_version, '[-+].*$', ''), '.')::int[]
            >= string_to_array(v_min_base, '.')::int[]
    ) then
      raise exception 'base_version_too_low' using errcode = 'P0001';
    end if;
  end if;

  v_source := case when v_category in ('private_extension', 'private_standalone')
                   then 'private_assignment'::public.install_source
                   else 'platform_push'::public.install_source end;

  select package_version into v_prior
  from public.company_packages where company_id = v_company and package_key = v_key;
  v_op := case when v_prior is null then 'install' else 'update' end;

  -- ---- Phase 2: apply (logged; rolls back atomically on failure) ----
  begin
    v_log := public.lifecycle_op_start(v_company, v_key, v_op, v_prior, v_version);

    if v_status = 'failed' then
      update public.package_installations set status = 'retrying' where id = p_installation_id;
    end if;
    update public.package_installations
       set status = 'installing', attempt_count = attempt_count + 1,
           last_attempt_at = now(), started_at = coalesce(started_at, now()), error = null
     where id = p_installation_id;

    insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source)
    values (v_company, v_key, v_version, true, 'installed', now(), v_source)
    on conflict (company_id, package_key) do update
      set package_version = excluded.package_version, enabled = true, status = 'installed',
          activated_at = now(), installation_source = v_source, updated_at = now();

    update public.package_installations
       set status = 'installed', completed_at = now(), error = null
     where id = p_installation_id;

    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_company, v_uid, 'update.installed', 'package_installation', p_installation_id,
            jsonb_build_object('package', v_key, 'version', v_version, 'source', v_source));

    perform public.lifecycle_op_complete(v_log);

    return jsonb_build_object('installation_id', p_installation_id, 'package_key', v_key,
                              'version', v_version, 'status', 'installed', 'operation_id', v_log);
  exception when others then
    perform public.lifecycle_op_failed(v_company, v_key, v_op, v_prior, v_version,
                                       public.lifecycle_failure_category(sqlstate, sqlerrm));
    return jsonb_build_object('installation_id', p_installation_id, 'package_key', v_key,
                              'status', 'failed', 'error', public.lifecycle_failure_category(sqlstate, sqlerrm));
  end;
end;
$$;

-- ===========================================================================
-- rollback_package_installation — Platform Admin reverts an installation.
-- ===========================================================================
create or replace function public.rollback_package_installation(p_installation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status public.installation_status;
  v_cid    uuid;
  v_key    text;
  v_prior  text;
  v_log    uuid;
begin
  -- ---- Phase 1: validation (raises; no monitoring record) ----
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select status, company_id, package_key
    into v_status, v_cid, v_key
  from public.package_installations where id = p_installation_id;

  if v_status is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'installed' then
    raise exception 'only an installed package can be rolled back' using errcode = 'P0001';
  end if;

  select package_version into v_prior
  from public.company_packages where company_id = v_cid and package_key = v_key;

  -- ---- Phase 2: apply (logged; rolls back atomically on failure) ----
  begin
    -- Rollback revokes the entitlement, so there is no target version.
    v_log := public.lifecycle_op_start(v_cid, v_key, 'rollback', v_prior, null);

    update public.package_installations
       set status = 'rolled_back', completed_at = now()
     where id = p_installation_id;

    update public.company_packages
       set enabled = false, updated_at = now()
     where company_id = v_cid and package_key = v_key;

    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_cid, v_uid, 'installation.rolled_back', 'package_installation', p_installation_id,
            jsonb_build_object('package', v_key));

    perform public.lifecycle_op_complete(v_log);

    return jsonb_build_object('id', p_installation_id, 'status', 'rolled_back', 'operation_id', v_log);
  exception when others then
    perform public.lifecycle_op_failed(v_cid, v_key, 'rollback', v_prior, null,
                                       public.lifecycle_failure_category(sqlstate, sqlerrm));
    return jsonb_build_object('id', p_installation_id, 'status', 'failed',
                              'error', public.lifecycle_failure_category(sqlstate, sqlerrm));
  end;
end;
$$;

-- ===========================================================================
-- process_package_installation — platform-side install/update processor.
-- Already had a catch-and-return apply phase; this adds the lifecycle record
-- to both outcomes without altering its contract.
-- ===========================================================================
create or replace function public.process_package_installation(p_installation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.installation_status;
  v_company uuid;
  v_key text;
  v_version text;
  v_error_code text;
  v_error_message text;
  v_prior text;
  v_op public.lifecycle_operation;
  v_log uuid;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select status, company_id, package_key, version
    into v_status, v_company, v_key, v_version
  from public.package_installations
  where id = p_installation_id
  for update;
  if v_status is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;
  if v_status = 'installed' then
    return jsonb_build_object('id', p_installation_id, 'company_id', v_company, 'status', 'installed', 'error', null);
  end if;
  if v_status not in ('pending', 'failed', 'retrying') then
    raise exception 'installation_not_processable' using errcode = 'P0001';
  end if;

  if v_status = 'failed' then
    update public.package_installations set status = 'retrying' where id = p_installation_id;
  end if;
  update public.package_installations
     set status = 'installing', attempt_count = attempt_count + 1,
         last_attempt_at = now(), started_at = coalesce(started_at, now()),
         error = null, last_error_code = null, last_error_message = null
   where id = p_installation_id;

  select package_version into v_prior
  from public.company_packages where company_id = v_company and package_key = v_key;
  v_op := case when v_prior is null then 'install' else 'update' end;

  begin
    v_log := public.lifecycle_op_start(v_company, v_key, v_op, v_prior, v_version);

    if not exists (select 1 from public.companies where id = v_company and status = 'active') then
      raise exception 'company_not_active' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.packages where key = v_key and is_active
    ) then
      raise exception 'package_inactive' using errcode = 'P0001';
    end if;

    insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
    values (v_company, v_key, v_version, true, 'installed', now())
    on conflict (company_id, package_key) do update
      set package_version = excluded.package_version, enabled = true,
          status = 'installed', activated_at = now(), updated_at = now();

    update public.package_installations
       set status = 'installed', completed_at = now(), error = null,
           last_error_code = null, last_error_message = null
     where id = p_installation_id;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_company, v_uid, 'installation.installed', 'package_installation', p_installation_id,
            jsonb_build_object('package', v_key, 'version', v_version));

    perform public.lifecycle_op_complete(v_log);

    return jsonb_build_object('id', p_installation_id, 'company_id', v_company, 'status', 'installed', 'error', null);
  exception when others then
    v_error_code := case when sqlerrm = 'company_not_active' then 'company_not_active'
                         when sqlerrm = 'package_inactive' then 'package_inactive'
                         else 'installation_failed' end;
    v_error_message := case when v_error_code = 'company_not_active' then 'Company is not active.'
                            when v_error_code = 'package_inactive' then 'Package is no longer active.'
                            else 'Installation could not be completed.' end;
    -- The protected block rolled back, taking the `running` record with it.
    perform public.lifecycle_op_failed(v_company, v_key, v_op, v_prior, v_version,
                                       public.lifecycle_failure_category(sqlstate, sqlerrm));
    update public.package_installations
       set status = 'failed', completed_at = null, error = v_error_message,
           last_error_code = v_error_code, last_error_message = v_error_message
     where id = p_installation_id;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_company, v_uid, 'installation.failed', 'package_installation', p_installation_id,
            jsonb_build_object('package', v_key, 'version', v_version, 'error_code', v_error_code));
    return jsonb_build_object('id', p_installation_id, 'company_id', v_company, 'status', 'failed', 'error', v_error_message);
  end;
end;
$$;
