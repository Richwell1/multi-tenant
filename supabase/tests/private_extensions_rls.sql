-- Private extensions: Platform-Admin-only assignment to exactly one company,
-- base + base-version gates, hidden from the marketplace, private_assignment
-- source, and tenant isolation. 7 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne Co', 'testone-pe', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo Co',  'testtwo-pe',  'active');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'testone-member@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'testtwo-member@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');
-- TestOne is on HR Core 1.1.0 (meets the Employee Approval min base); TestTwo on 1.0.0.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-000000000001', 'hr-core', '1.1.0', true, 'installed', now(), 'platform_push'),
  ('b0000000-0000-0000-0000-000000000002', 'hr-core', '1.0.0', true, 'installed', now(), 'registration_default');

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;
create or replace function pg_temp.denied(uid text, stmt text) returns boolean
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; execute stmt; execute 'reset role'; return false;
exception when others then
  begin execute 'reset role'; exception when others then end; return true;
end; $$;
create or replace function pg_temp.actor(uid text) returns void
language sql as $$ select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void; $$;

select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;

-- One company only.
select pg_temp.check(1, 'private extension cannot target all companies',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key='custom-employee-approval'), 'all_companies', '{}', true)$$));

-- Base version gate: TestTwo (HR Core 1.0.0) is below the 1.1.0 minimum.
select pg_temp.check(2, 'Employee Approval blocked when base HR Core version is too low',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key='custom-employee-approval'), 'one_company', array['b0000000-0000-0000-0000-000000000002']::uuid[], true)$$));

-- Assign Employee Approval to TestOne (HR Core 1.1.0).
select public.create_package_release((select id from public.package_versions where package_key='custom-employee-approval'), 'one_company', array['a0000000-0000-0000-0000-000000000001']::uuid[], true);
reset role;
select pg_temp.check(3, 'Employee Approval enabled for the target with private_assignment source',
  (select enabled and installation_source = 'private_assignment'
     from public.company_packages where company_id='a0000000-0000-0000-0000-000000000001' and package_key='custom-employee-approval'));
select pg_temp.check(4, 'non-target company has no Employee Approval entitlement',
  not exists (select 1 from public.company_packages where company_id='b0000000-0000-0000-0000-000000000002' and package_key='custom-employee-approval'));

-- Hidden from the marketplace: a non-entitled company cannot discover it.
select pg_temp.actor('b2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(5, 'private extension is not discoverable by other companies',
  (select count(*) = 0 from public.packages where key = 'custom-employee-approval'));
reset role;

-- Department Code (no min base version) assigns to TestTwo (HR Core 1.0.0).
select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;
select public.create_package_release((select id from public.package_versions where package_key='custom-department-code'), 'one_company', array['b0000000-0000-0000-0000-000000000002']::uuid[], true);
reset role;
select pg_temp.check(6, 'Department Code assigns to a company with HR Core (no min base version)',
  (select enabled and installation_source='private_assignment' from public.company_packages where company_id='b0000000-0000-0000-0000-000000000002' and package_key='custom-department-code'));
select pg_temp.check(7, 'private extensions are hidden (category private_extension, not marketplace)',
  (select bool_and(category = 'private_extension') from public.packages where key in ('custom-employee-approval','custom-department-code')));

rollback;
