-- =============================================================================
-- Multi-Tenants HR — Phase 4.2a: package release publishing (backend)
--
-- Adds release/targeting/installation tables and an atomic, Platform-Admin-only
-- publish RPC. Classification→target rules and authorization are enforced in the
-- database (not just the UI). Assignments are UPSERTed (history preserved,
-- unrelated packages untouched). packages.is_active = global kill switch;
-- company_packages.enabled = per-company switch.
-- =============================================================================

-- Extend classifications (existing: standard_update, private_customization,
-- shared_extension, bug_fix). New values are only added here, never used as a
-- literal in this same migration, so ADD VALUE is transaction-safe.
alter type public.package_type add value if not exists 'configuration_update';
alter type public.package_type add value if not exists 'security_update';

alter table public.packages add column if not exists description text;
alter table public.package_versions
  add column if not exists diagnostic_status text
  check (diagnostic_status in ('PASS', 'WARN', 'FAIL'));

create type public.release_target_mode as enum ('all_companies', 'selected_companies', 'one_company');
create type public.release_status as enum ('published', 'failed');
create type public.installation_status as enum (
  'pending', 'installing', 'installed', 'failed', 'retrying', 'rolled_back'
);

-- --- Releases ----------------------------------------------------------------
create table public.package_releases (
  id                 uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.package_versions (id) on delete cascade,
  target_mode        public.release_target_mode not null,
  status             public.release_status not null default 'published',
  automatic_install  boolean not null default true,
  released_by        uuid references auth.users (id) on delete set null,
  released_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
create index package_releases_version_idx on public.package_releases (package_version_id);

-- Explicit target companies for selected/one-company releases.
create table public.package_release_targets (
  id         uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.package_releases (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (release_id, company_id)
);
create index package_release_targets_company_idx on public.package_release_targets (company_id);

-- One installation row per resolved target company.
create table public.package_installations (
  id           uuid primary key default gen_random_uuid(),
  release_id   uuid not null references public.package_releases (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  package_key  text not null references public.packages (key) on delete restrict,
  version      text not null,
  status       public.installation_status not null default 'installed',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (release_id, company_id)
);
create index package_installations_company_idx on public.package_installations (company_id);
create index package_installations_release_idx on public.package_installations (release_id);

-- --- RLS (read-only for clients; writes only via the SECURITY DEFINER RPC) ----
alter table public.package_releases        enable row level security;
alter table public.package_releases        force  row level security;
alter table public.package_release_targets enable row level security;
alter table public.package_release_targets force  row level security;
alter table public.package_installations   enable row level security;
alter table public.package_installations   force  row level security;

-- Releases + targets are platform-plane data.
create policy package_releases_select on public.package_releases
  for select to authenticated using (public.is_platform_admin());
create policy package_release_targets_select on public.package_release_targets
  for select to authenticated using (public.is_platform_admin());

-- Installations: platform admins see all; a company sees only its own (tenant-safe).
create policy package_installations_select on public.package_installations
  for select to authenticated
  using (public.is_platform_admin() or public.is_company_member(company_id));

-- --- Atomic publish RPC ------------------------------------------------------
-- Platform-Admin-only. Validates version/package/classification, resolves target
-- companies, creates the release + targets + installations, UPSERTs company
-- package assignments (enabled=true), and writes audit rows — all in one
-- transaction. Rolls back entirely on any failure. Callable by authenticated
-- clients but self-authorizes via is_platform_admin(); definer rights bypass the
-- read-only RLS above to write.
create or replace function public.publish_package_release(
  p_version_id        uuid,
  p_target_mode       public.release_target_mode,
  p_company_ids       uuid[] default '{}',
  p_automatic_install boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_key     text;
  v_type    public.package_type;
  v_active  boolean;
  v_version text;
  v_targets uuid[];
  v_release uuid;
  v_state   public.installation_status;
  v_cid     uuid;
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

  -- Classification → target compatibility (DB-enforced, not just UI).
  if v_type = 'private_customization' and p_target_mode <> 'one_company' then
    raise exception 'invalid_target_for_private' using errcode = '22023';
  end if;
  if v_type = 'shared_extension' and p_target_mode = 'one_company' then
    raise exception 'invalid_target_for_shared' using errcode = '22023';
  end if;

  -- Resolve active target companies.
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

  v_state := case when p_automatic_install then 'installed' else 'pending' end;

  foreach v_cid in array v_targets loop
    insert into public.package_release_targets (release_id, company_id) values (v_release, v_cid);

    insert into public.package_installations (release_id, company_id, package_key, version, status, completed_at)
    values (v_release, v_cid, v_key, v_version, v_state,
            case when p_automatic_install then now() else null end);

    -- Assignment upsert: preserve history, enable, set version; never delete.
    if p_automatic_install then
      insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
      values (v_cid, v_key, v_version, true, 'installed', now())
      on conflict (company_id, package_key) do update
        set package_version = excluded.package_version,
            enabled = true,
            status = 'installed',
            activated_at = now(),
            updated_at = now();
    end if;

    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
    values (v_cid, v_uid, 'package.assigned', 'package_release', v_release,
            jsonb_build_object('package', v_key, 'version', v_version));
  end loop;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, v_uid, 'release.published', 'package_release', v_release,
          jsonb_build_object('package', v_key, 'version', v_version,
                             'target_mode', p_target_mode,
                             'target_count', coalesce(array_length(v_targets, 1), 0)));

  return jsonb_build_object(
    'release_id', v_release,
    'package_key', v_key,
    'version', v_version,
    'target_mode', p_target_mode,
    'target_count', coalesce(array_length(v_targets, 1), 0),
    'automatic_install', p_automatic_install
  );
end;
$$;

-- Callable by authenticated clients (self-authorizes via is_platform_admin); never anon.
revoke execute on function public.publish_package_release(uuid, public.release_target_mode, uuid[], boolean) from public;
revoke execute on function public.publish_package_release(uuid, public.release_target_mode, uuid[], boolean) from anon;
grant execute on function public.publish_package_release(uuid, public.release_target_mode, uuid[], boolean) to authenticated;
grant execute on function public.publish_package_release(uuid, public.release_target_mode, uuid[], boolean) to service_role;
