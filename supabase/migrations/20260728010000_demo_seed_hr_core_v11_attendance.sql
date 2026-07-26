-- Multi-Tenants HR — demo catalog seed
--
-- Minimal package-version feasibility demo. Seeds:
--   1. HR Core 1.1.0 (unreleased catalog version; the Admin publishes it during
--      the demo to move all active companies from 1.0.0 → 1.1.0).
--   2. Attendance Management package + 1.0.0 (unreleased; Admin publishes it as a
--      standard, all-company package).
-- Both get a passing diagnostic (report + all-PASS checks) so they are
-- publishable, mirroring the HR Core 1.0.0 seed. Idempotent (on conflict).
-- HR Core 1.1.0 stays UNRELEASED until the Admin publishes it, so onboarding
-- keeps assigning 1.0.0 until the demo update happens.

-- --- HR Core 1.1.0 (adds Employees) -----------------------------------------
insert into public.package_versions (package_key, version, notes, released_at)
values ('hr-core', '1.1.0', 'HR Core 1.1.0 — adds Employees.', null)
on conflict (package_key, version) do nothing;

-- --- Attendance Management package + 1.0.0 -----------------------------------
insert into public.packages (key, name, type, is_active)
values ('attendance-management', 'Attendance Management', 'standard_update', true)
on conflict (key) do nothing;

insert into public.package_versions (package_key, version, notes, released_at)
values ('attendance-management', '1.0.0', 'Attendance Management 1.0.0 — attendance tracking.', null)
on conflict (package_key, version) do nothing;

-- --- Passing diagnostics (report + all-PASS checks drive diagnostic_status) ---
insert into public.diagnostic_reports (id, package_version_id, summary, recommendation, result)
select 'd1a90000-0000-4000-8000-000000000002', pv.id,
       'HR Core 1.1.0 diagnostic.', 'Safe to release.', 'PASS'
from public.package_versions pv
join public.packages p on p.key = pv.package_key
where p.key = 'hr-core' and pv.version = '1.1.0'
on conflict do nothing;

insert into public.diagnostic_reports (id, package_version_id, summary, recommendation, result)
select 'd1a90000-0000-4000-8000-000000000003', pv.id,
       'Attendance Management 1.0.0 diagnostic.', 'Safe to release.', 'PASS'
from public.package_versions pv
join public.packages p on p.key = pv.package_key
where p.key = 'attendance-management' and pv.version = '1.0.0'
on conflict do nothing;

insert into public.diagnostic_checks (report_id, dimension, status, detail)
select 'd1a90000-0000-4000-8000-000000000002', d, 'PASS', 'No issues detected.'
from unnest(enum_range(null::public.diagnostic_dimension)) as d
where exists (select 1 from public.diagnostic_reports where id = 'd1a90000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.diagnostic_checks (report_id, dimension, status, detail)
select 'd1a90000-0000-4000-8000-000000000003', d, 'PASS', 'No issues detected.'
from unnest(enum_range(null::public.diagnostic_dimension)) as d
where exists (select 1 from public.diagnostic_reports where id = 'd1a90000-0000-4000-8000-000000000003')
on conflict do nothing;
