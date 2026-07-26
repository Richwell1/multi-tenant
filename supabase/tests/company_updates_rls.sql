-- Company Available Updates: tenant-scoped pending updates + company-side install.
-- 10 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne Co', 'testone-cu', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo Co', 'testtwo-cu', 'active');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'one-admin@x.com'),
  ('a3333333-3333-3333-3333-333333333333', 'one-user@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'two-admin@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'company_user', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');
-- TestOne is on HR Core 1.0.0 (base for the private extension) + has Document Notes installed.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-000000000001', 'hr-core', '1.0.0', true, 'installed', now(), 'registration_default'),
  ('a0000000-0000-0000-0000-000000000001', 'document-notes', '1.0.0', true, 'installed', now(), 'company_marketplace');

-- Pending manual releases assigned to TestOne: HR Core 1.1.0 (system) + Custom
-- Department Code (private extension). Plus an already-installed Document Notes
-- release (must be excluded).
insert into public.package_releases (id, package_version_id, target_mode, status, automatic_install, update_policy, released_by) values
  ('c1000000-0000-0000-0000-000000000001', (select id from public.package_versions where package_key='hr-core' and version='1.1.0'), 'all_companies', 'published', false, 'company_managed', 'a1111111-1111-1111-1111-111111111111'),
  ('c2000000-0000-0000-0000-000000000002', (select id from public.package_versions where package_key='custom-department-code' and version='1.0.0'), 'one_company', 'published', false, 'company_managed', 'a1111111-1111-1111-1111-111111111111'),
  ('c3000000-0000-0000-0000-000000000003', (select id from public.package_versions where package_key='document-notes' and version='1.0.0'), 'all_companies', 'published', true, 'platform_managed', 'a1111111-1111-1111-1111-111111111111');
insert into public.package_installations (id, release_id, company_id, package_key, version, status) values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'hr-core', '1.1.0', 'pending'),
  ('d2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'custom-department-code', '1.0.0', 'pending'),
  ('d3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'document-notes', '1.0.0', 'installed');

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

-- Read scoping.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(1, 'company reads its own pending updates (system + private extension)',
  (select count(*) = 2 from public.company_available_updates()));
select pg_temp.check(2, 'installed release is excluded from pending updates',
  (select count(*) = 0 from public.company_available_updates() where package_key = 'document-notes'));
select pg_temp.check(3, 'private extension update shows its category + base package',
  (select category = 'private_extension' and base_package_name = 'HR Core'
     from public.company_available_updates() where package_key = 'custom-department-code'));
select pg_temp.check(4, 'uninstalled marketplace package is not a pending update',
  (select count(*) = 0 from public.company_available_updates() where package_key = 'expense-requests'));
reset role;

select pg_temp.actor('b2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(5, 'another company does not see these updates',
  (select count(*) = 0 from public.company_available_updates()));
reset role;

-- Install authorization.
select pg_temp.check(6, 'company_user cannot install an update (role)',
  pg_temp.denied('a3333333-3333-3333-3333-333333333333', $$select public.install_company_update('d1000000-0000-0000-0000-000000000001')$$));
select pg_temp.check(7, 'another company cannot install a forged installation id',
  pg_temp.denied('b2222222-2222-2222-2222-222222222222', $$select public.install_company_update('d1000000-0000-0000-0000-000000000001')$$));

update public.companies set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.check(8, 'suspended company cannot install',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222', $$select public.install_company_update('d1000000-0000-0000-0000-000000000001')$$));
update public.companies set status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';

-- Successful install updates only the current company entitlement.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select public.install_company_update('d1000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.check(9, 'install updates the company entitlement + marks installed',
  (select package_version = '1.1.0' and enabled from public.company_packages where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'hr-core')
  and (select status = 'installed' from public.package_installations where id = 'd1000000-0000-0000-0000-000000000001'));

select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(10, 'installed update no longer appears as pending (count drops to 1)',
  (select count(*) = 1 from public.company_available_updates()));
reset role;

rollback;
