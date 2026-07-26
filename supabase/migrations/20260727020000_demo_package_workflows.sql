-- Multi-Tenants HR — demo package workflows
--
-- Narrows the package system to the three presentation workflows and adds the
-- few missing pieces:
--   1. General HR Core update to all active companies (transactional auto-install)
--   2. Private extension for one company (requires an enabled base package)
--   3. Standalone private package for one company (private_customization)
-- Plus: every newly registered active company receives the latest RELEASED,
-- diagnostic-PASS, highest-semver HR Core version (no hardcoded version).
--
-- Depends on 20260727010000 having committed the `private_extension` label.

-- --- Base-package dependency (only meaningful for private_extension) ----------
alter table public.packages
  add column if not exists base_package_key text references public.packages (key) on delete restrict;

-- --- Package + initial version creation, now with an optional base package ----
-- New signature (adds p_base_package_key); drop the old 6-arg form so PostgREST
-- exposes exactly one overload.
drop function if exists public.create_package_with_version(text, text, public.package_type, text, text, text);

create or replace function public.create_package_with_version(
  p_key text,
  p_name text,
  p_type public.package_type,
  p_description text,
  p_version text,
  p_release_notes text,
  p_base_package_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version_id uuid;
  v_base text := nullif(trim(coalesce(p_base_package_key, '')), '');
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

  -- Base-package rules: required + active for a private extension; forbidden
  -- (forced null) for every other type. Keep it simple — only existence + active.
  if p_type = 'private_extension' then
    if v_base is null then
      raise exception 'base_package_required' using errcode = '22023';
    end if;
    if v_base = p_key then
      raise exception 'base_package_cannot_be_self' using errcode = '22023';
    end if;
    if not exists (select 1 from public.packages where key = v_base and is_active) then
      raise exception 'base_package_not_found_or_inactive' using errcode = 'P0002';
    end if;
  else
    v_base := null;
  end if;

  insert into public.packages (key, name, type, description, is_active, base_package_key)
  values (p_key, trim(p_name), p_type, p_description, true, v_base);

  insert into public.package_versions (package_key, version, notes, released_at)
  values (p_key, p_version, trim(p_release_notes), null)
  returning id into v_version_id;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'package.created', 'package', null,
          jsonb_build_object('package', p_key, 'version', p_version, 'type', p_type, 'base_package_key', v_base));

  return jsonb_build_object(
    'package', jsonb_build_object(
      'key', p_key, 'name', trim(p_name), 'type', p_type,
      'description', p_description, 'is_active', true, 'base_package_key', v_base
    ),
    'version', jsonb_build_object(
      'id', v_version_id, 'package_key', p_key, 'version', p_version,
      'notes', trim(p_release_notes), 'compatibility_notes', '',
      'diagnostic_status', null, 'released_at', null
    )
  );
end;
$$;

-- --- Release: target rules + transactional automatic installation ------------
-- Same signature as before (body changed): keeps existing grants intact.
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
  v_base text;
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
  select p.key, p.type, p.is_active, p.base_package_key, pv.version
    into v_key, v_type, v_active, v_base, v_version
  from public.package_versions pv
  join public.packages p on p.key = pv.package_key
  where pv.id = p_version_id;
  if v_version is null then raise exception 'version_not_found' using errcode = 'P0002'; end if;
  if not v_active then raise exception 'package_inactive' using errcode = 'P0001'; end if;
  if public.version_release_blocked(p_version_id) then
    raise exception 'release_blocked_by_diagnostic' using errcode = 'P0001';
  end if;

  -- Classification -> target compatibility (DB-enforced, not just UI).
  if v_type in ('private_customization', 'private_extension') and p_target_mode <> 'one_company' then
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

  -- Private-extension dependency: the (single) target company must already have
  -- the base package enabled. Simple presence check — no compatibility ranges.
  if v_type = 'private_extension' then
    if v_base is null then
      raise exception 'base_package_required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.company_packages cp
      where cp.company_id = v_targets[1] and cp.package_key = v_base and cp.enabled
    ) then
      raise exception 'base_package_not_enabled' using errcode = 'P0001';
    end if;
  end if;

  -- Publishing stamps the version as released (used by onboarding to pick the
  -- default HR Core version for new companies).
  update public.package_versions
     set released_at = coalesce(released_at, now())
   where id = p_version_id;

  insert into public.package_releases (package_version_id, target_mode, status, automatic_install, released_by)
  values (p_version_id, p_target_mode, 'published', p_automatic_install, v_uid)
  returning id into v_release;

  foreach v_cid in array v_targets loop
    insert into public.package_release_targets (release_id, company_id)
    values (v_release, v_cid);

    if p_automatic_install then
      -- Transactional install: enable the entitlement and mark installed now.
      -- Any failure raises and rolls back the whole release (no partial state).
      insert into public.package_installations
        (release_id, company_id, package_key, version, status, started_at, completed_at,
         attempt_count, last_attempt_at)
      values (v_release, v_cid, v_key, v_version, 'installed', now(), now(), 1, now())
      returning id into v_installation;

      insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
      values (v_cid, v_key, v_version, true, 'installed', now())
      on conflict (company_id, package_key) do update
        set package_version = excluded.package_version, enabled = true,
            status = 'installed', activated_at = now(), updated_at = now();

      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (v_cid, v_uid, 'installation.installed', 'package_installation', v_installation,
              jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release));
      v_installations := v_installations || jsonb_build_array(
        jsonb_build_object('id', v_installation, 'company_id', v_cid, 'status', 'installed')
      );
    else
      -- Manual mode: record pending work only (existing two-stage behavior).
      insert into public.package_installations
        (release_id, company_id, package_key, version, status, completed_at)
      values (v_release, v_cid, v_key, v_version, 'pending', null)
      returning id into v_installation;

      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (v_cid, v_uid, 'installation.planned', 'package_installation', v_installation,
              jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release));
      v_installations := v_installations || jsonb_build_array(
        jsonb_build_object('id', v_installation, 'company_id', v_cid, 'status', 'pending')
      );
    end if;
  end loop;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'release.published', 'package_release', v_release,
          jsonb_build_object('package', v_key, 'version', v_version,
                             'target_mode', p_target_mode,
                             'target_count', coalesce(array_length(v_targets, 1), 0),
                             'automatic_install', p_automatic_install));

  return jsonb_build_object(
    'release_id', v_release, 'package_key', v_key, 'version', v_version,
    'target_mode', p_target_mode, 'target_count', array_length(v_targets, 1),
    'automatic_install', p_automatic_install, 'installations', v_installations
  );
end;
$$;

-- --- Onboarding: assign the latest eligible HR Core version -------------------
-- "Eligible" = globally active package, RELEASED version, diagnostic PASS.
-- Pick the highest semantic version (numeric core), never a hardcoded one.
-- Idempotent via unique(company_id, package_key); assigns ONLY hr-core.
create or replace function public.onboard_company(
  p_user_id       uuid,
  p_company_name  text,
  p_slug          text,
  p_subdomain     text,
  p_company_email text default null,
  p_phone         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug       text;
  v_subdomain  text;
  v_company_id uuid;
  v_hr_version text;
  v_role       public.company_role := 'company_admin';
begin
  v_slug := lower(trim(coalesce(p_slug, '')));
  v_subdomain := lower(trim(coalesce(nullif(p_subdomain, ''), p_slug)));

  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  if v_subdomain !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_subdomain' using errcode = '22023';
  end if;
  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'invalid_company_name' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.companies c where c.slug = v_slug) then
    raise exception 'duplicate_slug' using errcode = '23505';
  end if;
  if exists (select 1 from public.companies c where c.subdomain = v_subdomain) then
    raise exception 'duplicate_subdomain' using errcode = '23505';
  end if;

  if exists (select 1 from public.company_memberships m where m.user_id = p_user_id) then
    raise exception 'user_already_member' using errcode = '23505';
  end if;

  -- Latest eligible HR Core: active package, released, diagnostic PASS, highest
  -- semver. No hardcoded version. Fails safely if none exists.
  select pv.version into v_hr_version
  from public.package_versions pv
  join public.packages p on p.key = pv.package_key
  where pv.package_key = 'hr-core'
    and p.is_active
    and pv.released_at is not null
    and pv.diagnostic_status = 'PASS'
    and public.valid_semver(pv.version)
  order by string_to_array(regexp_replace(pv.version, '[-+].*$', ''), '.')::int[] desc
  limit 1;
  if v_hr_version is null then
    raise exception 'hr_core_unavailable' using errcode = 'P0001';
  end if;

  insert into public.companies (name, slug, subdomain, status)
  values (trim(p_company_name), v_slug, v_subdomain, 'active')
  returning id into v_company_id;

  insert into public.company_settings (company_id, company_email, phone)
  values (v_company_id, p_company_email, p_phone);

  insert into public.company_memberships (company_id, user_id, role)
  values (v_company_id, p_user_id, v_role);

  -- Mandatory HR Core entitlement/record (installed). Idempotent by unique key.
  insert into public.company_packages
    (company_id, package_key, package_version, enabled, status, activated_at)
  values (v_company_id, 'hr-core', v_hr_version, true, 'installed', now())
  on conflict (company_id, package_key) do update
    set package_version = excluded.package_version, enabled = true,
        status = 'installed', activated_at = now(), updated_at = now();

  insert into public.audit_logs
    (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_company_id, p_user_id, 'company.registered', 'company', v_company_id,
    jsonb_build_object('slug', v_slug, 'subdomain', v_subdomain, 'hr_core_version', v_hr_version)
  );

  return jsonb_build_object(
    'company_id', v_company_id,
    'slug', v_slug,
    'subdomain', v_subdomain,
    'role', v_role,
    'hr_core', jsonb_build_object('package_key', 'hr-core', 'version', v_hr_version)
  );
end;
$$;

-- --- Grants ------------------------------------------------------------------
revoke execute on function public.create_package_with_version(text, text, public.package_type, text, text, text, text) from public;
revoke execute on function public.create_package_with_version(text, text, public.package_type, text, text, text, text) from anon;
grant execute on function public.create_package_with_version(text, text, public.package_type, text, text, text, text) to authenticated;

-- onboard_company stays service_role-only.
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from public;
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from anon;
revoke execute on function public.onboard_company(uuid, text, text, text, text, text) from authenticated;
grant execute on function public.onboard_company(uuid, text, text, text, text, text) to service_role;
