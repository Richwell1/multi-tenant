-- Private standalone (Custom Visitor Register): one-company assignment, hidden,
-- private_assignment source, and tenant isolation. 6 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne Co', 'testone-ps', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo Co',  'testtwo-ps',  'active');
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin@x.com'),
  ('a2222222-2222-2222-2222-222222222222', 'testone-member@x.com'),
  ('b2222222-2222-2222-2222-222222222222', 'testtwo-member@x.com');
insert into public.platform_admins (user_id) values ('a1111111-1111-1111-1111-111111111111');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a2222222-2222-2222-2222-222222222222', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'company_admin', 'active');

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

select pg_temp.check(1, 'private standalone cannot target all companies',
  pg_temp.denied('a1111111-1111-1111-1111-111111111111',
    $$select public.create_package_release((select id from public.package_versions where package_key='custom-visitor-register'), 'all_companies', '{}', true)$$));

select public.create_package_release((select id from public.package_versions where package_key='custom-visitor-register'), 'one_company', array['a0000000-0000-0000-0000-000000000001']::uuid[], true);
reset role;
select pg_temp.check(2, 'assigned to exactly the target with private_assignment source',
  (select enabled and installation_source='private_assignment' from public.company_packages where company_id='a0000000-0000-0000-0000-000000000001' and package_key='custom-visitor-register')
  and not exists (select 1 from public.company_packages where company_id='b0000000-0000-0000-0000-000000000002' and package_key='custom-visitor-register'));

-- Target company can use it.
select pg_temp.actor('a2222222-2222-2222-2222-222222222222');
set local role authenticated;
insert into public.visitor_register (company_id, visitor_name, visit_purpose) values ('a0000000-0000-0000-0000-000000000001', 'Sam', 'Interview');
reset role;
select pg_temp.check(3, 'assigned company can add + read visitors',
  (select count(*) = 1 from public.visitor_register where company_id='a0000000-0000-0000-0000-000000000001'));

-- Other company cannot discover, read, or write.
select pg_temp.actor('b2222222-2222-2222-2222-222222222222');
set local role authenticated;
select pg_temp.check(4, 'non-target cannot read the register',
  (select count(*) = 0 from public.visitor_register));
select pg_temp.check(5, 'private standalone is not discoverable by other companies',
  (select count(*) = 0 from public.packages where key='custom-visitor-register'));
reset role;
select pg_temp.check(6, 'non-target cannot add visitors (no entitlement)',
  pg_temp.denied('b2222222-2222-2222-2222-222222222222',
    $$insert into public.visitor_register (company_id, visitor_name) values ('b0000000-0000-0000-0000-000000000002','X')$$));

rollback;
