-- Multi-Tenants HR — Admin package management and independent installations
--
-- Package creation/versioning and release planning are Platform-Admin-only
-- SECURITY DEFINER operations. A release plan creates pending work; each
-- installation is processed independently so one tenant cannot roll back the
-- work already completed for another tenant.

alter table public.package_versions
  add column if not exists compatibility_notes text not null default '';

alter table public.package_installations
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text,
  add column if not exists last_attempt_at timestamptz;

create or replace function public.valid_semver(p_version text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$';
$$;

-- Retry processing needs a short retrying -> installing transition.
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
    when 'retrying'   then to_status in ('installing', 'installed', 'failed')
    when 'installed'  then to_status in ('rolled_back')
    else false
  end;
$$;

create or replace function public.create_package_with_version(
  p_key text,
  p_name text,
  p_type public.package_type,
  p_description text,
  p_version text,
  p_release_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version_id uuid;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'package_name_required' using errcode = '22023';
  end if;
  if p_key is null or p_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'package_key_must_be_lowercase_kebab_case' using errcode = '22023';
  end if;
  if p_description is null then
    p_description := '';
  end if;
  if p_release_notes is null or trim(p_release_notes) = '' then
    raise exception 'release_notes_required' using errcode = '22023';
  end if;
  if not public.valid_semver(p_version) then
    raise exception 'invalid_semantic_version' using errcode = '22023';
  end if;
  if exists (select 1 from public.packages where key = p_key) then
    raise exception 'duplicate_package_key' using errcode = '23505';
  end if;

  insert into public.packages (key, name, type, description, is_active)
  values (p_key, trim(p_name), p_type, p_description, true);

  insert into public.package_versions (package_key, version, notes, released_at)
  values (p_key, p_version, trim(p_release_notes), null)
  returning id into v_version_id;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'package.created', 'package', null,
          jsonb_build_object('package', p_key, 'version', p_version, 'type', p_type));

  return jsonb_build_object(
    'package', jsonb_build_object(
      'key', p_key, 'name', trim(p_name), 'type', p_type,
      'description', p_description, 'is_active', true
    ),
    'version', jsonb_build_object(
      'id', v_version_id, 'package_key', p_key, 'version', p_version,
      'notes', trim(p_release_notes), 'compatibility_notes', '',
      'diagnostic_status', null, 'released_at', null
    )
  );
end;
$$;

create or replace function public.create_package_version(
  p_package_key text,
  p_version text,
  p_release_notes text,
  p_compatibility_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.packages where key = p_package_key and is_active) then
    if exists (select 1 from public.packages where key = p_package_key) then
      raise exception 'package_inactive' using errcode = 'P0001';
    end if;
    raise exception 'package_not_found' using errcode = 'P0002';
  end if;
  if not public.valid_semver(p_version) then
    raise exception 'invalid_semantic_version' using errcode = '22023';
  end if;
  if p_release_notes is null or trim(p_release_notes) = '' then
    raise exception 'release_notes_required' using errcode = '22023';
  end if;
  if exists (select 1 from public.package_versions where package_key = p_package_key and version = p_version) then
    raise exception 'duplicate_package_version' using errcode = '23505';
  end if;

  insert into public.package_versions (package_key, version, notes, compatibility_notes, released_at)
  values (p_package_key, p_version, trim(p_release_notes), coalesce(p_compatibility_notes, ''), null)
  returning id into v_id;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'package_version.created', 'package_version', v_id,
          jsonb_build_object('package', p_package_key, 'version', p_version));

  return jsonb_build_object(
    'id', v_id, 'package_key', p_package_key, 'version', p_version,
    'notes', trim(p_release_notes), 'compatibility_notes', coalesce(p_compatibility_notes, ''),
    'diagnostic_status', null, 'released_at', null
  );
end;
$$;

-- Stage A: resolve targets and create pending work only.
create or replace function public.create_package_release(
  p_version_id uuid,
  p_target_mode public.release_target_mode,
  p_company_ids uuid[] default '{}',
  p_automatic_install boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_type public.package_type;
  v_active boolean;
  v_version text;
  v_release uuid;
  v_targets uuid[];
  v_cid uuid;
  v_installations jsonb := '[]'::jsonb;
  v_installation uuid;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select p.key, p.type, p.is_active, pv.version
    into v_key, v_type, v_active, v_version
  from public.package_versions pv
  join public.packages p on p.key = pv.package_key
  where pv.id = p_version_id;
  if v_version is null then raise exception 'version_not_found' using errcode = 'P0002'; end if;
  if not v_active then raise exception 'package_inactive' using errcode = 'P0001'; end if;
  if public.version_release_blocked(p_version_id) then
    raise exception 'release_blocked_by_diagnostic' using errcode = 'P0001';
  end if;
  if v_type = 'private_customization' and p_target_mode <> 'one_company' then
    raise exception 'invalid_target_for_private' using errcode = '22023';
  end if;
  if v_type = 'shared_extension' and p_target_mode = 'one_company' then
    raise exception 'invalid_target_for_shared' using errcode = '22023';
  end if;

  if p_target_mode = 'all_companies' then
    select array_agg(id) into v_targets from public.companies where status = 'active';
  else
    select array_agg(distinct id) into v_targets
    from public.companies where id = any (p_company_ids) and status = 'active';
    if p_target_mode = 'one_company' and coalesce(array_length(v_targets, 1), 0) <> 1 then
      raise exception 'one_company_requires_single_target' using errcode = '22023';
    end if;
    if p_target_mode = 'selected_companies' and coalesce(array_length(v_targets, 1), 0) < 2 then
      raise exception 'selected_requires_two_targets' using errcode = '22023';
    end if;
  end if;
  if coalesce(array_length(v_targets, 1), 0) = 0 then
    raise exception 'no_target_companies' using errcode = '22023';
  end if;

  insert into public.package_releases (package_version_id, target_mode, status, automatic_install, released_by)
  values (p_version_id, p_target_mode, 'published', p_automatic_install, v_uid)
  returning id into v_release;

  foreach v_cid in array v_targets loop
    insert into public.package_release_targets (release_id, company_id)
    values (v_release, v_cid);
    insert into public.package_installations
      (release_id, company_id, package_key, version, status, completed_at)
    values (v_release, v_cid, v_key, v_version, 'pending', null)
    returning id into v_installation;
    v_installations := v_installations || jsonb_build_array(
      jsonb_build_object('id', v_installation, 'company_id', v_cid, 'status', 'pending')
    );
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_cid, v_uid, 'installation.planned', 'package_installation', v_installation,
            jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release));
  end loop;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'release.planned', 'package_release', v_release,
          jsonb_build_object('package', v_key, 'version', v_version,
                             'target_mode', p_target_mode,
                             'target_count', coalesce(array_length(v_targets, 1), 0)));

  return jsonb_build_object(
    'release_id', v_release, 'package_key', v_key, 'version', v_version,
    'target_mode', p_target_mode, 'target_count', array_length(v_targets, 1),
    'automatic_install', p_automatic_install, 'installations', v_installations
  );
end;
$$;

-- Stage B: process exactly one installation. Errors are converted to a safe
-- result and recorded on this row only; sibling installations are untouched.
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

  begin
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
    return jsonb_build_object('id', p_installation_id, 'company_id', v_company, 'status', 'installed', 'error', null);
  exception when others then
    v_error_code := case when sqlerrm = 'company_not_active' then 'company_not_active'
                         when sqlerrm = 'package_inactive' then 'package_inactive'
                         else 'installation_failed' end;
    v_error_message := case when v_error_code = 'company_not_active' then 'Company is not active.'
                            when v_error_code = 'package_inactive' then 'Package is no longer active.'
                            else 'Installation could not be completed.' end;
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

-- Retry now uses the independent processor rather than directly granting access.
create or replace function public.retry_package_installation(p_installation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.installation_status;
  v_result jsonb;
  v_company uuid;
  v_key text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select status into v_status from public.package_installations where id = p_installation_id;
  if v_status is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'failed' then
    raise exception 'only a failed installation can be retried' using errcode = 'P0001';
  end if;
  select company_id, package_key into v_company, v_key
  from public.package_installations where id = p_installation_id;
  v_result := public.process_package_installation(p_installation_id);
  if v_result->>'status' = 'installed' then
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_company, auth.uid(), 'installation.retried', 'package_installation', p_installation_id,
            jsonb_build_object('package', v_key));
  end if;
  return v_result;
end;
$$;

revoke execute on function public.valid_semver(text) from public;
revoke execute on function public.valid_semver(text) from anon;
grant execute on function public.valid_semver(text) to authenticated;
revoke execute on function public.create_package_with_version(text, text, public.package_type, text, text, text) from public;
revoke execute on function public.create_package_with_version(text, text, public.package_type, text, text, text) from anon;
grant execute on function public.create_package_with_version(text, text, public.package_type, text, text, text) to authenticated;
revoke execute on function public.create_package_version(text, text, text, text) from public;
revoke execute on function public.create_package_version(text, text, text, text) from anon;
grant execute on function public.create_package_version(text, text, text, text) to authenticated;
revoke execute on function public.create_package_release(uuid, public.release_target_mode, uuid[], boolean) from public;
revoke execute on function public.create_package_release(uuid, public.release_target_mode, uuid[], boolean) from anon;
grant execute on function public.create_package_release(uuid, public.release_target_mode, uuid[], boolean) to authenticated;
revoke execute on function public.process_package_installation(uuid) from public;
revoke execute on function public.process_package_installation(uuid) from anon;
grant execute on function public.process_package_installation(uuid) to authenticated;
