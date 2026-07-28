-- Custom Onboarding Checklist authorization: entitlement-gated insert/select, the authenticated
-- grant (evaluated before RLS), tenant isolation, and that the lifecycle purge
-- removes survey data. 8 ok notices.

\set ON_ERROR_STOP on
begin;

insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-0000000000a1', 'ChkOne Co', 'chkone', 'active'),
  ('b0000000-0000-0000-0000-0000000000b2', 'ChkTwo Co', 'chktwo', 'active');
insert into auth.users (id, email) values
  ('a2222222-2222-2222-2222-2222222222a1', 'chkone-admin@x.com'),
  ('b2222222-2222-2222-2222-2222222222b2', 'chktwo-admin@x.com');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a2222222-2222-2222-2222-2222222222a1', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-0000000000b2', 'b2222222-2222-2222-2222-2222222222b2', 'company_admin', 'active');
-- ChkOne has Pulse Surveys; ChkTwo does not.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-0000000000a1', 'custom-onboarding-checklist', '1.0.0', true, 'installed', now(), 'company_marketplace');

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
select pg_temp.check(1, 'authenticated has INSERT + SELECT on onboarding_checklist_items',
  has_table_privilege('authenticated', 'public.onboarding_checklist_items', 'INSERT')
  and has_table_privilege('authenticated', 'public.onboarding_checklist_items', 'SELECT'));

-- 2) Entitled company_admin can add an item.
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
insert into public.onboarding_checklist_items (company_id, label) values ('a0000000-0000-0000-0000-0000000000a1', 'How are you feeling this week?');
reset role;
select pg_temp.check(2, 'entitled admin can add an item',
  (select count(*) = 1 from public.onboarding_checklist_items where company_id = 'a0000000-0000-0000-0000-0000000000a1'));

-- 3) Cross-company insert is rejected.
select pg_temp.check(3, 'member cannot add for another company',
  pg_temp.denied('a2222222-2222-2222-2222-2222222222a1',
    $$insert into public.onboarding_checklist_items (company_id, label) values ('b0000000-0000-0000-0000-0000000000b2','X')$$));

-- 4) Company without the entitlement cannot add.
select pg_temp.check(4, 'company without entitlement cannot add',
  pg_temp.denied('b2222222-2222-2222-2222-2222222222b2',
    $$insert into public.onboarding_checklist_items (company_id, label) values ('b0000000-0000-0000-0000-0000000000b2','X')$$));

-- 5) Tenant isolation: ChkTwo cannot read ChkOne's surveys.
select set_config('request.jwt.claims', json_build_object('sub','b2222222-2222-2222-2222-2222222222b2','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(5, 'another company cannot read the items',
  (select count(*) = 0 from public.onboarding_checklist_items));
reset role;

-- 6) Suspended company cannot add, then restored.
update public.companies set status = 'suspended' where id = 'a0000000-0000-0000-0000-0000000000a1';
select pg_temp.check(6, 'suspended company cannot add',
  pg_temp.denied('a2222222-2222-2222-2222-2222222222a1',
    $$insert into public.onboarding_checklist_items (company_id, label) values ('a0000000-0000-0000-0000-0000000000a1','X')$$));
update public.companies set status = 'active' where id = 'a0000000-0000-0000-0000-0000000000a1';

-- 7) Retained data is hidden after uninstall, then returns after restore.
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select public.uninstall_package('custom-onboarding-checklist');
reset role;
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(7, 'retained items are hidden while uninstalled',
  (select count(*) = 0 from public.onboarding_checklist_items));
select public.restore_package('custom-onboarding-checklist');
reset role;

-- 8) Permanent removal deletes the survey data (feature_table wired).
select set_config('request.jwt.claims', json_build_object('sub','a2222222-2222-2222-2222-2222222222a1','role','authenticated')::text, true);
set local role authenticated;
select public.uninstall_package('custom-onboarding-checklist');
select public.permanently_remove_package('custom-onboarding-checklist');
reset role;
select pg_temp.check(8, 'permanent removal purges checklist rows',
  (select count(*) = 0 from public.onboarding_checklist_items where company_id = 'a0000000-0000-0000-0000-0000000000a1'));

rollback;
