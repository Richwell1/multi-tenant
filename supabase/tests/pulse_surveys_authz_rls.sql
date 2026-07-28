-- Pulse Surveys authorization: entitlement-gated insert/select, the authenticated
-- grant (evaluated before RLS), tenant isolation, and that the lifecycle purge
-- removes survey data. 8 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-0000000000a1', 'PulseOne Co', 'pulseone', 'active'),
  ('b0000000-0000-0000-0000-0000000000b2', 'PulseTwo Co', 'pulsetwo', 'active');
insert into auth.users (id, email) values
  ('a2222222-2222-2222-2222-2222222222a1', 'pulseone-admin@x.com'),
  ('b2222222-2222-2222-2222-2222222222b2', 'pulsetwo-admin@x.com');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a2222222-2222-2222-2222-2222222222a1', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-0000000000b2', 'b2222222-2222-2222-2222-2222222222b2', 'company_admin', 'active');
-- PulseOne has Pulse Surveys; PulseTwo does not.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-0000000000a1', 'pulse-surveys', '1.0.0', true, 'installed', now(), 'company_marketplace');

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

-- 1) authenticated holds INSERT + SELECT privilege (grants before RLS).
select pg_temp.check(1, 'authenticated has INSERT + SELECT on pulse_surveys',
  has_table_privilege('authenticated', 'public.pulse_surveys', 'INSERT')
  and has_table_privilege('authenticated', 'public.pulse_surveys', 'SELECT'));

-- 2) Entitled company_admin can create a survey.
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
insert into public.pulse_surveys (company_id, question) values ('a0000000-0000-0000-0000-0000000000a1', 'How are you feeling this week?');
reset role;
select pg_temp.check(2, 'entitled admin can create a survey',
  (select count(*) = 1 from public.pulse_surveys where company_id = 'a0000000-0000-0000-0000-0000000000a1'));

-- 3) Cross-company insert is rejected.
select pg_temp.check(3, 'member cannot create for another company',
  pg_temp.denied('a2222222-2222-2222-2222-2222222222a1',
    $$insert into public.pulse_surveys (company_id, question) values ('b0000000-0000-0000-0000-0000000000b2','X')$$));

-- 4) Company without the entitlement cannot create.
select pg_temp.check(4, 'company without entitlement cannot create',
  pg_temp.denied('b2222222-2222-2222-2222-2222222222b2',
    $$insert into public.pulse_surveys (company_id, question) values ('b0000000-0000-0000-0000-0000000000b2','X')$$));

-- 5) Tenant isolation: PulseTwo cannot read PulseOne's surveys.
select set_config('request.jwt.claims', json_build_object('sub','b2222222-2222-2222-2222-2222222222b2','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(5, 'another company cannot read the surveys',
  (select count(*) = 0 from public.pulse_surveys));
reset role;

-- 6) Suspended company cannot create, then restored.
update public.companies set status = 'suspended' where id = 'a0000000-0000-0000-0000-0000000000a1';
select pg_temp.check(6, 'suspended company cannot create',
  pg_temp.denied('a2222222-2222-2222-2222-2222222222a1',
    $$insert into public.pulse_surveys (company_id, question) values ('a0000000-0000-0000-0000-0000000000a1','X')$$));
update public.companies set status = 'active' where id = 'a0000000-0000-0000-0000-0000000000a1';

-- 7) Retained data is hidden after uninstall, then returns after restore.
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select public.uninstall_package('pulse-surveys');
reset role;
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(7, 'retained surveys are hidden while uninstalled',
  (select count(*) = 0 from public.pulse_surveys));
select public.restore_package('pulse-surveys');
reset role;

-- 8) Permanent removal deletes the survey data (feature_table wired).
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select public.uninstall_package('pulse-surveys');
select public.permanently_remove_package('pulse-surveys');
reset role;
select pg_temp.check(8, 'permanent removal purges survey rows',
  (select count(*) = 0 from public.pulse_surveys where company_id = 'a0000000-0000-0000-0000-0000000000a1'));

rollback;
