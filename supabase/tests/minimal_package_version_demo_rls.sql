-- Minimal package-version demo: publish the SEEDED HR Core 1.1.0 to all active
-- companies, register new companies onto the latest version, and push Attendance
-- Management 1.0.0. A clean run emits 9 ok notices and rolls back all fixtures.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a1000000-0000-0000-0000-000000000001', 'Alpha Co', 'alpha-min', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'Beta Co',  'beta-min',  'active'),
  ('c1000000-0000-0000-0000-000000000003', 'Gamma Co', 'gamma-min', 'suspended');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'alpha-user@x.com'),
  ('c2222222-2222-2222-2222-222222222222', 'gamma-user@x.com'),
  ('d0000000-0000-0000-0000-000000000000', 'early@x.com'),
  ('d2000000-0000-0000-0000-000000000002', 'late@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a1000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('c1000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'company_admin', 'active');

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

-- Give Alpha the seeded HR Core 1.0.0 baseline (as onboarding would).
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
values ('a1000000-0000-0000-0000-000000000001', 'hr-core', '1.0.0', true, 'installed', now()),
       ('b1000000-0000-0000-0000-000000000002', 'hr-core', '1.0.0', true, 'installed', now());

-- Register a company BEFORE HR Core 1.1.0 is published → it gets 1.0.0.
select public.onboard_company('d0000000-0000-0000-0000-000000000000', 'Early Co', 'early-co', 'early-co', 'early@x.com', null) as early \gset
select pg_temp.check(8, 'registration is not hardcoded — early company gets 1.0.0 (latest released)',
  ((:'early'::jsonb)->'hr_core'->>'version') = '1.0.0');

-- Admin publishes the SEEDED HR Core 1.1.0 to all active companies (automatic).
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.create_package_release(
  (select id from public.package_versions where package_key = 'hr-core' and version = '1.1.0'),
  'all_companies', '{}', true) as rel \gset

select pg_temp.check(4, 'publishing HR Core 1.1.0 updates all active companies',
  (select package_version = '1.1.0' from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'hr-core')
  and (select package_version = '1.1.0' from public.company_packages where company_id = 'b1000000-0000-0000-0000-000000000002' and package_key = 'hr-core'));
select pg_temp.check(5, 'suspended company excluded from the HR Core update',
  not exists (select 1 from public.company_packages where company_id = 'c1000000-0000-0000-0000-000000000003' and package_key = 'hr-core'));
select pg_temp.check(6, 'automatic install: entitlement installed with no company action',
  (select enabled and status = 'installed' from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'hr-core'));

-- Register a company AFTER 1.1.0 is published → it gets 1.1.0.
reset role;
select public.onboard_company('d2000000-0000-0000-0000-000000000002', 'Late Co', 'late-co', 'late-co', 'late@x.com', null) as late \gset
select (:'late'::jsonb)->>'company_id' as late_company \gset
select pg_temp.check(7, 'newly registered company receives the latest HR Core version (1.1.0)',
  ((:'late'::jsonb)->'hr_core'->>'version') = '1.1.0');

-- Idempotency: re-running the HR Core assignment does not duplicate.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
values ((:'late_company')::uuid, 'hr-core', '1.1.0', true, 'installed', now())
on conflict (company_id, package_key) do update set package_version = excluded.package_version, updated_at = now();
select pg_temp.check(9, 'no duplicate HR Core entitlement on retry',
  (select count(*) = 1 from public.company_packages where company_id = (:'late_company')::uuid and package_key = 'hr-core'));

-- Attendance is NOT auto-assigned at registration.
select pg_temp.check(11, 'attendance is not auto-assigned and not accessible before release',
  not exists (select 1 from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'attendance-management')
  and not public.can_use_company_package('a1000000-0000-0000-0000-000000000001', 'attendance-management', 'a2222222-2222-2222-2222-222222222222'));

-- Admin publishes the SEEDED Attendance Management 1.0.0 to all active companies.
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.create_package_release(
  (select id from public.package_versions where package_key = 'attendance-management' and version = '1.0.0'),
  'all_companies', '{}', true);
select pg_temp.check(10, 'Attendance 1.0.0 appears (entitlement enabled) after the admin release',
  (select enabled and package_version = '1.0.0' from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'attendance-management')
  and public.can_use_company_package('a1000000-0000-0000-0000-000000000001', 'attendance-management', 'a2222222-2222-2222-2222-222222222222')
  -- suspended company cannot access it
  and not public.can_use_company_package('c1000000-0000-0000-0000-000000000003', 'attendance-management', 'c2222222-2222-2222-2222-222222222222'));

rollback;
