-- Admin package management and independent installation processing.
-- A clean run emits 18 ok notices and rolls back all fixtures.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a1000000-0000-0000-0000-000000000001', 'TestOne Package Co', 'testone-package', 'active'),
  ('b1000000-0000-0000-0000-000000000002', 'TestTwo Package Co', 'testtwo-package', 'active'),
  ('c1000000-0000-0000-0000-000000000003', 'TestThree Package Co', 'testthree-package', 'suspended');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'package-admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'package-user@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a1000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active');

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
  execute 'set local role authenticated';
  execute stmt;
  execute 'reset role';
  return false;
exception when others then
  begin execute 'reset role'; exception when others then end;
  return true;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

select pg_temp.actor('a1111111-1111-1111-1111-111111111111');
set local role authenticated;

select pg_temp.check(1, 'platform admin creates package and first version',
  (public.create_package_with_version('testone-private', 'TestOne Private', 'private_customization', 'Private feature', '1.0.0', 'Initial private release')->'version'->>'version') = '1.0.0');
select pg_temp.check(2, 'invalid semantic version rejected',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111', $$select public.create_package_with_version('bad-version', 'Bad', 'standard_update', '', '1.0', 'notes')$$));
select pg_temp.check(3, 'duplicate package key rejected',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111', $$select public.create_package_with_version('testone-private', 'Duplicate', 'standard_update', '', '1.0.0', 'notes')$$));
select pg_temp.check(4, 'non-admin cannot create package',
  pg_temp.denied('a2222222-2222-2222-2222-222222222222', $$select public.create_package_with_version('not-allowed', 'Nope', 'standard_update', '', '1.0.0', 'notes')$$));
select pg_temp.check(5, 'new package is not assigned during creation',
  not exists (select 1 from public.company_packages where package_key = 'testone-private'));
select pg_temp.check(6, 'new version is not published',
  not exists (select 1 from public.package_releases pr join public.package_versions pv on pv.id = pr.package_version_id where pv.package_key = 'testone-private'));
select pg_temp.check(7, 'duplicate version rejected',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111', $$select public.create_package_version('testone-private', '1.0.0', 'duplicate')$$));
select pg_temp.check(8, 'second version can be created without assignment',
  (public.create_package_version('testone-private', '1.1.0', 'Second release', 'No migration')->>'version') = '1.1.0');

insert into public.packages (key, name, type, is_active) values ('standard-plan', 'Standard Plan', 'standard_update', true);
insert into public.package_versions (package_key, version, notes) values ('standard-plan', '1.0.0', 'plan release');

select pg_temp.check(9, 'private package only accepts one-company target',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111', $$select public.create_package_release((select id from public.package_versions where package_key = 'testone-private' and version = '1.0.0'), 'all_companies', '{}', false)$$));
select pg_temp.check(10, 'standard package accepts one-company target',
  (public.create_package_release((select id from public.package_versions where package_key = 'standard-plan'), 'one_company', array['a1000000-0000-0000-0000-000000000001']::uuid[], false)->>'target_count') = '1');
select pg_temp.check(11, 'standard package accepts selected target',
  (public.create_package_release((select id from public.package_versions where package_key = 'standard-plan'), 'selected_companies', array['a1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002']::uuid[], false)->>'target_count') = '2');
select pg_temp.check(12, 'suspended companies excluded from all-company plan',
  (public.create_package_release((select id from public.package_versions where package_key = 'standard-plan'), 'all_companies', '{}', false)->>'target_count') = '2');

select pg_temp.check(13, 'release plan creates independent pending installations',
  (select count(*) >= 2 from public.package_installations pi join public.package_releases pr on pr.id = pi.release_id where pr.package_version_id = (select id from public.package_versions where package_key = 'standard-plan') and pi.status = 'pending'));

-- Create a fresh two-company plan in MANUAL mode (automatic_install = false), so
-- installations start pending and are processed independently. Then make TestTwo
-- inactive to force only TestTwo's processor call to fail. TestOne's completed work
-- must remain intact. (Automatic mode installs transactionally — covered in the
-- demo suite.)
select public.create_package_release((select id from public.package_versions where package_key = 'standard-plan'), 'selected_companies', array['a1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000002']::uuid[], false)->>'release_id' as release_id \gset
select id as testone_installation from public.package_installations where release_id = :'release_id' and company_id = 'a1000000-0000-0000-0000-000000000001' \gset
select id as testtwo_installation from public.package_installations where release_id = :'release_id' and company_id = 'b1000000-0000-0000-0000-000000000002' \gset
update public.companies set status = 'suspended' where id = 'b1000000-0000-0000-0000-000000000002';
select public.process_package_installation(:'testone_installation'::uuid);
select public.process_package_installation(:'testtwo_installation'::uuid);
select pg_temp.check(14, 'TestOne succeeds while TestTwo fails',
  (select status = 'installed' from public.package_installations where id = :'testone_installation'::uuid)
  and (select status = 'failed' from public.package_installations where id = :'testtwo_installation'::uuid));
select pg_temp.check(15, 'TestOne entitlement remains after TestTwo failure',
  (select enabled and package_version = '1.0.0' from public.company_packages where company_id = 'a1000000-0000-0000-0000-000000000001' and package_key = 'standard-plan')
  and not exists (select 1 from public.company_packages where company_id = 'b1000000-0000-0000-0000-000000000002' and package_key = 'standard-plan'));
update public.companies set status = 'active' where id = 'b1000000-0000-0000-0000-000000000002';
select public.retry_package_installation(:'testtwo_installation'::uuid);
select pg_temp.check(16, 'retry processes TestTwo only',
  (select status = 'installed' and attempt_count = 2 from public.package_installations where id = :'testtwo_installation'::uuid)
  and (select attempt_count = 1 from public.package_installations where id = :'testone_installation'::uuid));
select pg_temp.check(17, 'package audit records created',
  (select count(*) >= 4 from public.audit_logs where action in ('package.created', 'package_version.created', 'release.published', 'installation.planned', 'installation.installed', 'installation.failed')));
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(18, 'non-admin cannot read platform release plans',
  (select count(*) = 0 from public.package_releases));

rollback;
