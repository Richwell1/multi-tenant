-- =============================================================================
-- Multi-Tenants HR — Phase 5.3: Installation Monitoring & Recovery
--
-- package_installations rows are created by the publish RPC (Phase 4.2). This
-- adds the recovery half: a state machine for the install lifecycle plus two
-- Platform-Admin-only actions that also keep entitlements consistent:
--   retry    — a FAILED install is recovered to INSTALLED (re-enables the
--              company's package assignment)
--   rollback — an INSTALLED package is ROLLED_BACK (disables the assignment, so
--              the tenant immediately loses access via can_use_company_package)
--
-- Writes stay RPC-only (no client UPDATE policy); the trigger enforces the
-- machine even for the SECURITY DEFINER RPCs (defense in depth). The actor is
-- recorded from auth.uid().
-- =============================================================================

-- --- Installation state machine ----------------------------------------------
-- pending    → installing | failed
-- installing → installed | failed
-- failed     → retrying | installed | rolled_back
-- retrying   → installed | failed
-- installed  → rolled_back
-- rolled_back is terminal.
create or replace function public.installation_can_transition(
  from_status public.installation_status,
  to_status public.installation_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case from_status
    when 'pending'    then to_status in ('installing', 'failed')
    when 'installing' then to_status in ('installed', 'failed')
    when 'failed'     then to_status in ('retrying', 'installed', 'rolled_back')
    when 'retrying'   then to_status in ('installed', 'failed')
    when 'installed'  then to_status in ('rolled_back')
    else false
  end;
$$;

create or replace function public.enforce_installation_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not public.installation_can_transition(old.status, new.status) then
    raise exception 'invalid installation transition from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger package_installations_enforce_transition
  before update on public.package_installations
  for each row execute function public.enforce_installation_transition();

-- --- Recovery: retry a failed installation -----------------------------------
create or replace function public.retry_package_installation(p_installation_id uuid)
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
  v_version text;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select status, company_id, package_key, version
    into v_status, v_cid, v_key, v_version
  from public.package_installations where id = p_installation_id;

  if v_status is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'failed' then
    raise exception 'only a failed installation can be retried' using errcode = 'P0001';
  end if;

  update public.package_installations
     set status = 'installed', completed_at = now(), error = null
   where id = p_installation_id;

  -- Recovery restores the tenant's entitlement.
  insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
  values (v_cid, v_key, v_version, true, 'installed', now())
  on conflict (company_id, package_key) do update
    set enabled = true, status = 'installed', activated_at = now(), updated_at = now();

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_cid, v_uid, 'installation.retried', 'package_installation', p_installation_id,
          jsonb_build_object('package', v_key, 'version', v_version));

  return jsonb_build_object('id', p_installation_id, 'status', 'installed');
end;
$$;
revoke execute on function public.retry_package_installation(uuid) from public;
revoke execute on function public.retry_package_installation(uuid) from anon;
grant execute on function public.retry_package_installation(uuid) to authenticated;
grant execute on function public.retry_package_installation(uuid) to service_role;

-- --- Recovery: roll back an installed package --------------------------------
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
begin
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

  update public.package_installations
     set status = 'rolled_back', completed_at = now()
   where id = p_installation_id;

  -- Rollback revokes the entitlement: the tenant loses access immediately
  -- (company_has_package requires enabled = true).
  update public.company_packages
     set enabled = false, updated_at = now()
   where company_id = v_cid and package_key = v_key;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (v_cid, v_uid, 'installation.rolled_back', 'package_installation', p_installation_id,
          jsonb_build_object('package', v_key));

  return jsonb_build_object('id', p_installation_id, 'status', 'rolled_back');
end;
$$;
revoke execute on function public.rollback_package_installation(uuid) from public;
revoke execute on function public.rollback_package_installation(uuid) from anon;
grant execute on function public.rollback_package_installation(uuid) to authenticated;
grant execute on function public.rollback_package_installation(uuid) to service_role;
