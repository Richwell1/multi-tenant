-- =============================================================================
-- Multi-Tenants HR — Phase 5.2: Diagnostics & Release Gate (platform operations)
--
-- A diagnostic report evaluates a package version across fixed impact dimensions
-- (frontend/backend/database/security/dependency/data + rollback readiness +
-- test evidence). Each dimension is a CHECK with status PASS | WARN | FAIL. The
-- report's overall result is derived from its checks (FAIL > WARN > PASS) and
-- kept on `package_versions.diagnostic_status` for the release UI.
--
-- The critical rule — enforced in the DB (publish RPC) AND mirrored in the
-- application service:
--   A release cannot be published while any REQUIRED check is FAIL.
--   WARN requires review (allowed); PASS is clear.
--
-- Diagnostics are PLATFORM-PLANE data (Platform-Admin-only), and completing the
-- Phase 5.1 deferral, `request_records.diagnostic_id` now FKs a report.
-- =============================================================================

create type public.diagnostic_dimension as enum (
  'frontend', 'backend', 'database', 'security',
  'dependency', 'data_impact', 'rollback', 'test_evidence'
);
create type public.diagnostic_status as enum ('PASS', 'WARN', 'FAIL');

-- --- Reports -----------------------------------------------------------------
create table public.diagnostic_reports (
  id                 uuid primary key default gen_random_uuid(),
  package_version_id uuid not null references public.package_versions (id) on delete cascade,
  summary            text not null default '',
  recommendation     text not null default '',
  -- Derived from the checks by trigger; FAIL > WARN > PASS. Default PASS (no checks).
  result             public.diagnostic_status not null default 'PASS',
  created_by         uuid references auth.users (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index diagnostic_reports_version_idx on public.diagnostic_reports (package_version_id);

create trigger diagnostic_reports_set_updated_at
  before update on public.diagnostic_reports
  for each row execute function public.set_updated_at();

-- --- Checks (one row per evaluated dimension) --------------------------------
create table public.diagnostic_checks (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.diagnostic_reports (id) on delete cascade,
  dimension  public.diagnostic_dimension not null,
  status     public.diagnostic_status not null default 'PASS',
  -- A required check that FAILs blocks release; non-required checks inform only.
  required   boolean not null default true,
  detail     text not null default '',
  created_at timestamptz not null default now(),
  unique (report_id, dimension)
);
create index diagnostic_checks_report_idx on public.diagnostic_checks (report_id);

-- Complete the Phase 5.1 deferral: a request points at its diagnostic report.
alter table public.request_records
  add constraint request_records_diagnostic_fk
  foreign key (diagnostic_id) references public.diagnostic_reports (id) on delete set null;

-- --- Result derivation -------------------------------------------------------
-- Recompute a report's overall result from its checks and mirror it onto the
-- package version so the release UI and the gate read one consistent value.
create or replace function public.recompute_diagnostic_result(p_report uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.diagnostic_status;
  v_version uuid;
begin
  select case
           when bool_or(status = 'FAIL') then 'FAIL'
           when bool_or(status = 'WARN') then 'WARN'
           else 'PASS'
         end
    into v_result
  from public.diagnostic_checks
  where report_id = p_report;

  v_result := coalesce(v_result, 'PASS');

  update public.diagnostic_reports
     set result = v_result, updated_at = now()
   where id = p_report
  returning package_version_id into v_version;

  update public.package_versions
     set diagnostic_status = v_result::text
   where id = v_version;
end;
$$;
revoke execute on function public.recompute_diagnostic_result(uuid) from public;
revoke execute on function public.recompute_diagnostic_result(uuid) from anon;
revoke execute on function public.recompute_diagnostic_result(uuid) from authenticated;

create or replace function public.on_diagnostic_check_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_diagnostic_result(coalesce(new.report_id, old.report_id));
  return coalesce(new, old);
end;
$$;
revoke execute on function public.on_diagnostic_check_change() from public;
revoke execute on function public.on_diagnostic_check_change() from anon;
revoke execute on function public.on_diagnostic_check_change() from authenticated;

create trigger diagnostic_checks_recompute
  after insert or update or delete on public.diagnostic_checks
  for each row execute function public.on_diagnostic_check_change();

-- --- Audit -------------------------------------------------------------------
create or replace function public.log_diagnostic_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'diagnostic.created';
  elsif new.result is distinct from old.result then
    v_action := 'diagnostic.evaluated';
  else
    return new;
  end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (null, auth.uid(), v_action, 'diagnostic_report', coalesce(new.id, old.id),
          jsonb_build_object('package_version_id', new.package_version_id, 'result', new.result));
  return new;
end;
$$;
revoke execute on function public.log_diagnostic_audit() from public;
revoke execute on function public.log_diagnostic_audit() from anon;
revoke execute on function public.log_diagnostic_audit() from authenticated;

create trigger diagnostic_reports_audit
  after insert or update on public.diagnostic_reports
  for each row execute function public.log_diagnostic_audit();

-- --- The release gate helper -------------------------------------------------
-- True when a version has any REQUIRED check that FAILs (i.e. release blocked).
create or replace function public.version_release_blocked(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.diagnostic_checks c
    join public.diagnostic_reports r on r.id = c.report_id
    where r.package_version_id = p_version_id
      and c.required
      and c.status = 'FAIL'
  );
$$;
revoke execute on function public.version_release_blocked(uuid) from public;
revoke execute on function public.version_release_blocked(uuid) from anon;
grant execute on function public.version_release_blocked(uuid) to authenticated;

-- --- Row-Level Security (Platform-Admin-only, platform-plane) -----------------
alter table public.diagnostic_reports enable row level security;
alter table public.diagnostic_reports force row level security;
alter table public.diagnostic_checks  enable row level security;
alter table public.diagnostic_checks  force row level security;

create policy diagnostic_reports_all on public.diagnostic_reports
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy diagnostic_checks_all on public.diagnostic_checks
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- --- Publish RPC: add the diagnostic gate ------------------------------------
-- Re-defines the Phase 4.2 publish function, adding the release gate right after
-- the version/package validation. Everything else is unchanged.
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

  -- Release gate: a required diagnostic check in FAIL blocks publication.
  if public.version_release_blocked(p_version_id) then
    raise exception 'release_blocked_by_diagnostic' using errcode = 'P0001';
  end if;

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

-- --- Seed: a passing diagnostic for the HR Core version (demo/reference) ------
-- Catalog reference so the Supabase release UI shows a real diagnostic. All eight
-- dimensions PASS → HR Core is publishable.
insert into public.diagnostic_reports (id, package_version_id, summary, recommendation, result)
select 'd1a90000-0000-4000-8000-000000000001', pv.id,
       'HR Core baseline diagnostic.', 'Safe to release.', 'PASS'
from public.package_versions pv
join public.packages p on p.key = pv.package_key
where p.key = 'hr-core' and pv.version = '1.0.0'
on conflict do nothing;

insert into public.diagnostic_checks (report_id, dimension, status, detail)
select 'd1a90000-0000-4000-8000-000000000001', d, 'PASS', 'No issues detected.'
from unnest(enum_range(null::public.diagnostic_dimension)) as d
where exists (select 1 from public.diagnostic_reports where id = 'd1a90000-0000-4000-8000-000000000001')
on conflict do nothing;
