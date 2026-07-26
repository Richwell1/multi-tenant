-- Demo package workflows: general HR Core update, private extension (base-gated),
-- standalone private package, and latest-HR-Core-at-registration.
--
-- A clean run emits 23 ok notices and rolls back all fixtures. Scenarios 13
-- (global APP_VERSION stays v0.1.0) and 14 (package version displays separately)
-- are frontend constants and are covered by unit tests, not this SQL suite.

\set ON_ERROR_STOP on
begin;

-- --- Fixtures ----------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a1000000-0000-0000-0000-000000000001', 'Alpha Co', 'alpha-demo', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'Beta Co',  'beta-demo',  'active'),
  ('c1000000-0000-0000-0000-000000000003', 'Gamma Co', 'gamma-demo', 'suspended');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'alpha-user@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'beta-user@x.com'),
  ('d0000000-0000-0000-0000-000000000000', 'reg0@x.com'),
  ('d2000000-0000-0000-0000-000000000002', 'reg2@x.com'),
  ('d3000000-0000-0000-0000-000000000003', 'reg3@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a1000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- True if running `stmt` as the given authenticated user raises (authz OR
-- business-rule rejection).
create or replace function pg_temp.denied(uid text, stmt text) returns boolean
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute stmt;
  execute 'reset role';
  return false;
exception when others then
  begin execute 'reset role'; exception when others then end;
  return true;
end; $$;

-- True if `stmt` raises in the current (owner) context — used for service-role
-- onboarding, which is not an authenticated call.
create or replace function pg_temp.errored(stmt text) returns boolean
language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

-- ============================================================================
-- Registration BEFORE HR Core 1.2.0 exists → new company gets the seeded 1.0.0.
-- (onboard_company is service_role-only; the suite runs as the DB owner.)
-- ============================================================================
reset role;
select public.onboard_company('d0000000-0000-0000-0000-000000000000', 'Reg Zero Co', 'reg-zero', 'reg-zero', 'reg0@x.com', null) as reg0 \gset
select (:'reg0'::jsonb)->'hr_core'->>'version' as reg0_version \gset
select (:'reg0'::jsonb)->>'company_id' as reg0_company \gset

-- ============================================================================
-- Workflow 1 — general HR Core update to all active companies (automatic).
-- ============================================================================
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.create_package_version('hr-core', '1.2.0', 'HR Core 1.2.0 — general update.') as v110 \gset
select pg_temp.check(1, 'HR Core 1.2.0 version created',
  (:'v110'::jsonb->>'version') = '1.2.0');

-- Mark 1.2.0 diagnostic PASS (in reality via a diagnostic report; here directly)
-- so it is eligible for release and future registrations.
reset role;
update public.package_versions set diagnostic_status = 'PASS' where package_key = 'hr-core' and version = '1.2.0';
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;

select public.create_package_release(
  (select id from public.package_versions where package_key = 'hr-core' and version = '1.2.0'),
  'all_companies', '{}', true) as rel1 \gset

select pg_temp.check(2, 'publish targets every active company',
  (:'rel1'::jsonb->>'target_count')::int = (select count(*) from public.companies where status = 'active'));
select pg_temp.check(3, 'suspended company excluded from the release',
  not exists (select 1 from public.package_installations pi
              where pi.release_id = (:'rel1'::jsonb->>'release_id')::uuid
                and pi.company_id = 'c1000000-0000-0000-0000-000000000003'));
select pg_temp.check(4, 'automatic install enables entitlement with no company action',
  (select enabled and status = 'installed' and package_version = '1.2.0'
     from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'hr-core')
  and (select enabled and package_version = '1.2.0'
     from public.company_packages where company_id = 'b1000000-0000-0000-0000-000000000002' and package_key = 'hr-core'));
select pg_temp.check(23, 'suspended company not moved to the new version',
  not exists (select 1 from public.company_packages
              where company_id = 'c1000000-0000-0000-0000-000000000003' and package_key = 'hr-core'));

-- ============================================================================
-- Registration AFTER 1.2.0 → new company gets 1.2.0 (new default). Not hardcoded.
-- ============================================================================
reset role;
select public.onboard_company('d2000000-0000-0000-0000-000000000002', 'Reg Two Co', 'reg-two', 'reg-two', 'reg2@x.com', null) as reg2 \gset
select (:'reg2'::jsonb)->'hr_core'->>'version' as reg2_version \gset
select (:'reg2'::jsonb)->>'company_id' as reg2_company \gset

select pg_temp.check(16, 'new company receives the latest released HR Core version',
  :'reg2_version' = '1.2.0');
select pg_temp.check(17, 'registration is not hardcoded (0 got 1.0.0, later got 1.2.0)',
  :'reg0_version' = '1.0.0' and :'reg2_version' = '1.2.0');
select pg_temp.check(18, 'new company receives an HR Core entitlement automatically',
  (select enabled from public.company_packages where company_id = (:'reg2_company')::uuid and package_key = 'hr-core'));
select pg_temp.check(19, 'installation record created for the latest HR Core version',
  (select status = 'installed' and package_version = '1.2.0'
     from public.company_packages where company_id = (:'reg2_company')::uuid and package_key = 'hr-core'));
select pg_temp.check(21, 'registration assigns only HR Core (no private packages)',
  (select count(*) = 1 and bool_and(package_key = 'hr-core')
     from public.company_packages where company_id = (:'reg2_company')::uuid));
select pg_temp.check(22, 'all-company release changed the default for future registrations',
  :'reg2_version' = (select version from public.package_versions
                     where package_key = 'hr-core' and released_at is not null and diagnostic_status = 'PASS'
                     order by string_to_array(version, '.')::int[] desc limit 1));
select pg_temp.check(24, 'newly registered active company still receives the latest version',
  (select package_version = '1.2.0' from public.company_packages
     where company_id = (:'reg2_company')::uuid and package_key = 'hr-core'));

-- Idempotency: re-running the HR Core assignment must not duplicate rows.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at)
values ((:'reg2_company')::uuid, 'hr-core', '1.2.0', true, 'installed', now())
on conflict (company_id, package_key) do update
  set package_version = excluded.package_version, enabled = true, status = 'installed', updated_at = now();
select pg_temp.check(20, 'retrying provisioning does not duplicate entitlement/installation',
  (select count(*) = 1 from public.company_packages where company_id = (:'reg2_company')::uuid and package_key = 'hr-core'));

-- ============================================================================
-- Workflow 2 — private extension of an existing base package, for one company.
-- ============================================================================
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;

-- Base package (Attendance Management) + enable it for Alpha only.
select public.create_package_with_version('demo-attend-base', 'Demo Attendance Base', 'standard_update', 'Attendance base', '1.0.0', 'Attendance base release');
select public.create_package_release(
  (select id from public.package_versions where package_key = 'demo-attend-base' and version = '1.0.0'),
  'one_company', array['a1000000-0000-0000-0000-000000000001']::uuid[], true);

select pg_temp.check(5, 'private extension is created with a base package',
  (public.create_package_with_version('alpha-attendance-approval', 'Alpha Attendance Approval Rules', 'private_extension',
     'Approval rules', '1.0.0', 'Initial private extension', 'demo-attend-base')->'package'->>'base_package_key') = 'demo-attend-base');
select pg_temp.check(6, 'private extension without a base package is rejected',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_with_version('bad-extension', 'Bad Extension', 'private_extension', 'x', '1.0.0', 'notes')$$));
select pg_temp.check(7, 'private extension can only target one company',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key = 'alpha-attendance-approval'), 'all_companies', '{}', true)$$));
select pg_temp.check(8, 'target company must already have the base package enabled',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key = 'alpha-attendance-approval'), 'one_company', array['b1000000-0000-0000-0000-000000000002']::uuid[], true)$$));

-- Publish the extension to Alpha (which has the base) — enables it.
select public.create_package_release(
  (select id from public.package_versions where package_key = 'alpha-attendance-approval'),
  'one_company', array['a1000000-0000-0000-0000-000000000001']::uuid[], true);
select pg_temp.check(11, 'successful installation enables the extension entitlement',
  (select enabled and status = 'installed' from public.company_packages
     where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'alpha-attendance-approval'));
select pg_temp.check(12, 'non-target company has no access to the extension',
  not exists (select 1 from public.company_packages
              where company_id = 'b1000000-0000-0000-0000-000000000002' and package_key = 'alpha-attendance-approval'));

-- ============================================================================
-- Workflow 3 — standalone private package (private_customization), one company.
-- ============================================================================
select pg_temp.check(9, 'standalone private package is created',
  (public.create_package_with_version('alpha-payroll-loans', 'Alpha Payroll Loans', 'private_customization',
     'Payroll loans', '1.0.0', 'Initial standalone release')->'package'->>'type') = 'private_customization');
select pg_temp.check(10, 'standalone private package can only target one company',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key = 'alpha-payroll-loans'), 'all_companies', '{}', true)$$));

select public.create_package_release(
  (select id from public.package_versions where package_key = 'alpha-payroll-loans'),
  'one_company', array['a1000000-0000-0000-0000-000000000001']::uuid[], true);

-- ============================================================================
-- Access enforcement (DB mirror of route/nav guards) + safe-fail registration.
-- ============================================================================
select pg_temp.check(15, 'entitlement gate allows the target and blocks others',
  public.can_use_company_package('a1000000-0000-0000-0000-000000000001', 'alpha-attendance-approval', 'a2222222-2222-2222-2222-222222222222')
  and not public.can_use_company_package('b1000000-0000-0000-0000-000000000002', 'alpha-attendance-approval', 'b2222222-2222-2222-2222-222222222222'));

reset role;
update public.packages set is_active = false where key = 'hr-core';
select pg_temp.check(25, 'registration fails safely when no valid HR Core version exists',
  pg_temp.errored($$select public.onboard_company('d3000000-0000-0000-0000-000000000003', 'Reg Three Co', 'reg-three', 'reg-three', 'reg3@x.com', null)$$)
  and not exists (select 1 from public.companies where slug = 'reg-three'));
update public.packages set is_active = true where key = 'hr-core';

rollback;
