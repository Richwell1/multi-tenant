-- Multi-Tenants HR — company-side Available Updates
--
-- Two Platform-Admin-independent operations for a company:
--   1. company_available_updates() — read the pending updates ASSIGNED to the
--      caller's own company (release installations awaiting install). Scoped to
--      the caller's active membership; never returns another company's updates.
--   2. install_company_update(id) — an active company_admin installs one of its
--      OWN pending/failed updates. Base + base-version gated, tenant-checked.
--
-- Marketplace updates are auto-applied to adopters (platform_managed), so they
-- do not appear here as pending — they are already installed. Uninstalled
-- marketplace packages have no installation and are excluded (they live only in
-- the Extensions Marketplace).

-- --- Read: pending updates for the caller's company ---------------------------
create or replace function public.company_available_updates()
returns table (
  release_id uuid,
  installation_id uuid,
  package_key text,
  package_name text,
  category text,
  installed_version text,
  available_version text,
  base_package_name text,
  release_notes text,
  released_at timestamptz,
  installation_state text,
  update_policy text,
  automatic_install boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select m.company_id
    from public.company_memberships m
    join public.companies c on c.id = m.company_id
    where m.user_id = auth.uid() and m.status = 'active' and c.status = 'active'
    limit 1
  )
  select r.id, pi.id, pi.package_key, p.name, p.category::text,
         cp.package_version, pi.version,
         bp.name, pv.notes, r.released_at, pi.status::text,
         r.update_policy::text, r.automatic_install
  from public.package_installations pi
  join me on me.company_id = pi.company_id
  join public.package_releases r on r.id = pi.release_id
  join public.package_versions pv on pv.id = r.package_version_id
  join public.packages p on p.key = pi.package_key
  left join public.packages bp on bp.key = p.base_package_key
  left join public.company_packages cp on cp.company_id = pi.company_id and cp.package_key = pi.package_key
  where pi.status in ('pending', 'failed')
    -- Not already on this version: either not entitled yet, or installed is older.
    and (cp.package_version is null
         or string_to_array(regexp_replace(pi.version, '[-+].*$', ''), '.')::int[]
            > string_to_array(regexp_replace(cp.package_version, '[-+].*$', ''), '.')::int[])
  order by r.released_at desc nulls last;
$$;

-- --- Write: company installs one of its own assigned updates ------------------
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
begin
  select pi.company_id, pi.status, pi.package_key, pi.version
    into v_company, v_status, v_key, v_version
  from public.package_installations pi
  where pi.id = p_installation_id;
  if v_company is null then raise exception 'installation_not_found' using errcode = 'P0002'; end if;

  -- Caller must be an active company_admin of THIS installation's active company.
  -- (Blocks installing another company's update by guessing an installation id.)
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

  -- Dependency gate for private extensions.
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

  -- Respect the installation state machine: pending/failed -> installing -> installed.
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

  return jsonb_build_object('installation_id', p_installation_id, 'package_key', v_key,
                            'version', v_version, 'status', 'installed');
end;
$$;

-- --- Grants (self-authorizing; company-scoped) -------------------------------
revoke execute on function public.company_available_updates() from public, anon;
grant execute on function public.company_available_updates() to authenticated;
revoke execute on function public.install_company_update(uuid) from public, anon;
grant execute on function public.install_company_update(uuid) to authenticated;
