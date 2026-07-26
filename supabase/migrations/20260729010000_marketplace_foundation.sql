-- Multi-Tenants HR — marketplace + private-package foundation
--
-- Adds the distribution/ownership axis (category + visibility), installation
-- provenance (installation_source), a private-extension base-version gate, the
-- company self-install path (security-gated), an admin "push update to
-- installers" path, and admin adoption reads. No company names/slugs/ids appear
-- anywhere — targeting is always company_id + package_key + entitlement rows.

-- --- Enums (new types; usable immediately) -----------------------------------
create type public.package_category as enum (
  'standard_package', 'marketplace_extension', 'private_standalone', 'private_extension'
);
create type public.install_source as enum (
  'platform_push', 'company_marketplace', 'private_assignment', 'registration_default'
);
create type public.update_policy as enum ('platform_managed', 'company_managed');

-- --- Columns + backfills ------------------------------------------------------
alter table public.packages
  add column if not exists category public.package_category not null default 'standard_package',
  add column if not exists min_base_version text;

-- Derive category for existing packages from their change-type. Marketplace
-- packages are introduced by explicit seeds (they set category directly).
update public.packages set category = case type
  when 'private_extension' then 'private_extension'::public.package_category
  when 'private_customization' then 'private_standalone'::public.package_category
  else 'standard_package'::public.package_category
end;

alter table public.company_packages
  add column if not exists installation_source public.install_source not null default 'platform_push';
-- HR Core arrives via registration; everything else existing is a platform push.
update public.company_packages set installation_source = 'registration_default' where package_key = 'hr-core';

-- Marketplace/registration self-installs have no release row.
alter table public.package_installations alter column release_id drop not null;

alter table public.package_releases
  add column if not exists update_policy public.update_policy not null default 'platform_managed';

-- --- Tighten package discovery ----------------------------------------------
-- A company may read: marketplace packages (to browse) + any package it is
-- entitled to (to resolve its own installed private packages). It must NOT
-- discover other companies' private packages. Platform admins read all.
drop policy if exists packages_select on public.packages;
create policy packages_select on public.packages
  for select to authenticated
  using (
    public.is_platform_admin()
    or (is_active and category = 'marketplace_extension')
    or exists (
      select 1 from public.company_packages cp
      where cp.package_key = packages.key and public.is_company_member(cp.company_id)
    )
  );

-- --- Package creation now records a category ---------------------------------
drop function if exists public.create_package_with_version(text, text, public.package_type, text, text, text, text);
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
  v_category public.package_category;
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
  if p_description is null then p_description := ''; end if;
  if p_release_notes is null or trim(p_release_notes) = '' then
    raise exception 'release_notes_required' using errcode = '22023';
  end if;
  if not public.valid_semver(p_version) then
    raise exception 'invalid_semantic_version' using errcode = '22023';
  end if;
  if exists (select 1 from public.packages where key = p_key) then
    raise exception 'duplicate_package_key' using errcode = '23505';
  end if;

  if p_type = 'private_extension' then
    if v_base is null then raise exception 'base_package_required' using errcode = '22023'; end if;
    if v_base = p_key then raise exception 'base_package_cannot_be_self' using errcode = '22023'; end if;
    if not exists (select 1 from public.packages where key = v_base and is_active) then
      raise exception 'base_package_not_found_or_inactive' using errcode = 'P0002';
    end if;
  else
    v_base := null;
  end if;

  v_category := case p_type
    when 'private_extension' then 'private_extension'::public.package_category
    when 'private_customization' then 'private_standalone'::public.package_category
    else 'standard_package'::public.package_category
  end;

  insert into public.packages (key, name, type, description, is_active, base_package_key, category)
  values (p_key, trim(p_name), p_type, p_description, true, v_base, v_category);

  insert into public.package_versions (package_key, version, notes, released_at)
  values (p_key, p_version, trim(p_release_notes), null)
  returning id into v_version_id;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'package.created', 'package', null,
          jsonb_build_object('package', p_key, 'version', p_version, 'type', p_type, 'category', v_category, 'base_package_key', v_base));

  return jsonb_build_object(
    'package', jsonb_build_object('key', p_key, 'name', trim(p_name), 'type', p_type,
      'description', p_description, 'is_active', true, 'base_package_key', v_base, 'category', v_category),
    'version', jsonb_build_object('id', v_version_id, 'package_key', p_key, 'version', p_version,
      'notes', trim(p_release_notes), 'compatibility_notes', '', 'diagnostic_status', null, 'released_at', null)
  );
end;
$$;

-- --- Release now records installation_source + enforces min base version -----
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
  v_category public.package_category;
  v_active boolean;
  v_base text;
  v_min_base text;
  v_version text;
  v_source public.install_source;
  v_release uuid;
  v_targets uuid[];
  v_cid uuid;
  v_installations jsonb := '[]'::jsonb;
  v_installation uuid;
begin
  if not public.is_platform_admin(v_uid) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select p.key, p.type, p.category, p.is_active, p.base_package_key, p.min_base_version, pv.version
    into v_key, v_type, v_category, v_active, v_base, v_min_base, v_version
  from public.package_versions pv
  join public.packages p on p.key = pv.package_key
  where pv.id = p_version_id;
  if v_version is null then raise exception 'version_not_found' using errcode = 'P0002'; end if;
  if not v_active then raise exception 'package_inactive' using errcode = 'P0001'; end if;
  if public.version_release_blocked(p_version_id) then
    raise exception 'release_blocked_by_diagnostic' using errcode = 'P0001';
  end if;

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

  if v_type = 'private_extension' then
    if v_base is null then raise exception 'base_package_required' using errcode = '22023'; end if;
    if not exists (
      select 1 from public.company_packages cp
      where cp.company_id = v_targets[1] and cp.package_key = v_base and cp.enabled
    ) then
      raise exception 'base_package_not_enabled' using errcode = 'P0001';
    end if;
    if v_min_base is not null and not exists (
      select 1 from public.company_packages cp
      where cp.company_id = v_targets[1] and cp.package_key = v_base and cp.enabled
        and public.valid_semver(cp.package_version)
        and string_to_array(regexp_replace(cp.package_version, '[-+].*$', ''), '.')::int[]
            >= string_to_array(v_min_base, '.')::int[]
    ) then
      raise exception 'base_version_too_low' using errcode = 'P0001';
    end if;
  end if;

  v_source := case when v_category in ('private_extension', 'private_standalone')
                   then 'private_assignment'::public.install_source
                   else 'platform_push'::public.install_source end;

  update public.package_versions set released_at = coalesce(released_at, now()) where id = p_version_id;

  insert into public.package_releases (package_version_id, target_mode, status, automatic_install, released_by)
  values (p_version_id, p_target_mode, 'published', p_automatic_install, v_uid)
  returning id into v_release;

  foreach v_cid in array v_targets loop
    insert into public.package_release_targets (release_id, company_id) values (v_release, v_cid);
    if p_automatic_install then
      insert into public.package_installations
        (release_id, company_id, package_key, version, status, started_at, completed_at, attempt_count, last_attempt_at)
      values (v_release, v_cid, v_key, v_version, 'installed', now(), now(), 1, now())
      returning id into v_installation;
      insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source)
      values (v_cid, v_key, v_version, true, 'installed', now(), v_source)
      on conflict (company_id, package_key) do update
        set package_version = excluded.package_version, enabled = true, status = 'installed',
            activated_at = now(), installation_source = v_source, updated_at = now();
      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (v_cid, v_uid, 'installation.installed', 'package_installation', v_installation,
              jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release, 'source', v_source));
      v_installations := v_installations || jsonb_build_array(jsonb_build_object('id', v_installation, 'company_id', v_cid, 'status', 'installed'));
    else
      insert into public.package_installations (release_id, company_id, package_key, version, status, completed_at)
      values (v_release, v_cid, v_key, v_version, 'pending', null)
      returning id into v_installation;
      insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
      values (v_cid, v_uid, 'installation.planned', 'package_installation', v_installation,
              jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release));
      v_installations := v_installations || jsonb_build_array(jsonb_build_object('id', v_installation, 'company_id', v_cid, 'status', 'pending'));
    end if;
  end loop;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'release.published', 'package_release', v_release,
          jsonb_build_object('package', v_key, 'version', v_version, 'target_mode', p_target_mode,
                             'target_count', coalesce(array_length(v_targets, 1), 0),
                             'automatic_install', p_automatic_install, 'source', v_source));

  return jsonb_build_object('release_id', v_release, 'package_key', v_key, 'version', v_version,
    'target_mode', p_target_mode, 'target_count', array_length(v_targets, 1),
    'automatic_install', p_automatic_install, 'installations', v_installations);
end;
$$;

-- --- Company self-install (marketplace only, fully gated) ---------------------
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
begin
  -- Caller must be an active company_admin of an active company.
  select m.company_id into v_company
  from public.company_memberships m
  join public.companies c on c.id = m.company_id
  where m.user_id = v_uid and m.status = 'active' and m.role = 'company_admin' and c.status = 'active'
  limit 1;
  if v_company is null then raise exception 'not_authorized' using errcode = '42501'; end if;

  -- Only an active marketplace package is installable this way (private blocked).
  if not exists (select 1 from public.packages where key = p_package_key and is_active and category = 'marketplace_extension') then
    raise exception 'not_marketplace_package' using errcode = '42501';
  end if;

  if exists (select 1 from public.company_packages where company_id = v_company and package_key = p_package_key and enabled) then
    raise exception 'already_installed' using errcode = 'P0001';
  end if;

  -- Latest released + diagnostic-PASS version (highest semver).
  select pv.version into v_version
  from public.package_versions pv
  where pv.package_key = p_package_key and pv.released_at is not null and pv.diagnostic_status = 'PASS'
    and public.valid_semver(pv.version)
  order by string_to_array(regexp_replace(pv.version, '[-+].*$', ''), '.')::int[] desc
  limit 1;
  if v_version is null then raise exception 'no_installable_version' using errcode = 'P0001'; end if;

  -- Dependency: base package (if any) must be enabled for this company.
  select base_package_key into v_base from public.packages where key = p_package_key;
  if v_base is not null and not exists (
    select 1 from public.company_packages where company_id = v_company and package_key = v_base and enabled
  ) then
    raise exception 'dependency_not_met' using errcode = 'P0001';
  end if;

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

  return jsonb_build_object('package_key', p_package_key, 'version', v_version, 'company_id', v_company,
                            'installed_version', v_version, 'installation_source', 'company_marketplace');
end;
$$;

-- --- Admin pushes a marketplace update to companies that already installed ----
create or replace function public.publish_update_to_installers(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_version text;
  v_release uuid;
  v_cid uuid;
  v_count int := 0;
  v_install uuid;
begin
  if not public.is_platform_admin(v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select p.key, pv.version into v_key, v_version
  from public.package_versions pv join public.packages p on p.key = pv.package_key
  where pv.id = p_version_id and p.category = 'marketplace_extension';
  if v_version is null then raise exception 'version_not_found' using errcode = 'P0002'; end if;
  if public.version_release_blocked(p_version_id) then raise exception 'release_blocked_by_diagnostic' using errcode = 'P0001'; end if;

  update public.package_versions set released_at = coalesce(released_at, now()) where id = p_version_id;
  insert into public.package_releases (package_version_id, target_mode, status, automatic_install, update_policy, released_by)
  values (p_version_id, 'selected_companies', 'published', true, 'platform_managed', v_uid)
  returning id into v_release;

  for v_cid in select company_id from public.company_packages where package_key = v_key and enabled loop
    insert into public.package_release_targets (release_id, company_id) values (v_release, v_cid);
    update public.company_packages set package_version = v_version, status = 'installed', activated_at = now(), updated_at = now()
      where company_id = v_cid and package_key = v_key;
    insert into public.package_installations (release_id, company_id, package_key, version, status, started_at, completed_at, attempt_count, last_attempt_at)
    values (v_release, v_cid, v_key, v_version, 'installed', now(), now(), 1, now())
    returning id into v_install;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_cid, v_uid, 'marketplace.updated', 'package_installation', v_install,
            jsonb_build_object('package', v_key, 'version', v_version, 'release_id', v_release));
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('release_id', v_release, 'package_key', v_key, 'version', v_version, 'installer_count', v_count);
end;
$$;

-- --- Admin adoption read (platform-admin self-gated) -------------------------
create or replace function public.marketplace_adoption()
returns table (package_key text, package_name text, install_count bigint, distinct_companies bigint)
language sql
security definer
set search_path = ''
as $$
  select p.key, p.name,
         count(cp.company_id) as install_count,
         count(distinct cp.company_id) as distinct_companies
  from public.packages p
  left join public.company_packages cp on cp.package_key = p.key and cp.enabled
  where public.is_platform_admin() and p.category = 'marketplace_extension'
  group by p.key, p.name
  order by p.name;
$$;

-- --- Grants ------------------------------------------------------------------
revoke execute on function public.install_marketplace_extension(text) from public, anon;
grant execute on function public.install_marketplace_extension(text) to authenticated;
revoke execute on function public.publish_update_to_installers(uuid) from public, anon;
grant execute on function public.publish_update_to_installers(uuid) to authenticated;
revoke execute on function public.marketplace_adoption() from public, anon;
grant execute on function public.marketplace_adoption() to authenticated;
revoke execute on function public.create_package_with_version(text, text, public.package_type, text, text, text, text) from public, anon;
grant execute on function public.create_package_with_version(text, text, public.package_type, text, text, text, text) to authenticated;
