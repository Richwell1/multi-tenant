-- =============================================================================
-- Attendance Management — JWT / RLS security verification (Phase 4.3B)
--
-- Self-contained: seeds tenants/users/memberships/package assignments/employees
-- in a transaction, exercises the policies + state machine as each JWT, then
-- rolls back. Run with:
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/attendance_rls.sql
--
-- A clean run ends with 18 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha', 'alpha', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta',  'beta',  'active'),
  ('c0000000-0000-0000-0000-000000000003', 'Gamma', 'gamma', 'suspended');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin.alpha@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'user.alpha@x.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin.beta@x.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin.gamma@x.com'),
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('66666666-6666-6666-6666-666666666666', 'inactive.alpha@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');

insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'company_user',  'active'),
  ('a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'company_admin', 'inactive'),
  ('b0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'company_admin', 'active'),
  ('c0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'company_admin', 'active');

-- attendance-management globally active; entitle alpha and gamma (gamma suspended,
-- must still be denied). Beta is NOT entitled (until scenario 18 assigns it).
insert into public.packages (key, name, type, is_active) values
  ('attendance-management', 'Attendance Management', 'standard_update', true)
on conflict (key) do update set is_active = excluded.is_active;

insert into public.package_versions (id, package_key, version, notes, released_at) values
  ('99999999-0000-0000-0000-0000000000a0', 'attendance-management', '2.0.0', 'seed', now())
on conflict (package_key, version) do nothing;

insert into public.company_packages (company_id, package_key, enabled) values
  ('a0000000-0000-0000-0000-000000000001', 'attendance-management', true),
  ('c0000000-0000-0000-0000-000000000003', 'attendance-management', true);

insert into public.employees (id, company_id, employee_number, full_name) values
  ('e0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'A-001', 'Alpha One'),
  ('e0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000002', 'B-001', 'Beta One'),
  ('e0000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-000000000003', 'C-001', 'Gamma One');

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

create or replace function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------

-- 11. company_admin can create (check-in) and then check out.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time, status)
  values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-20', '09:00', 'present');
update public.attendance_records set check_out_time = '17:00'
  where company_id = 'a0000000-0000-0000-0000-000000000001' and attendance_date = '2026-07-20';
reset role;
select pg_temp.check(11, 'company_admin can create + check out',
  (select check_out_time = '17:00' from public.attendance_records
     where company_id = 'a0000000-0000-0000-0000-000000000001' limit 1));

-- 1. entitled Alpha admin reads Alpha attendance.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(1, 'entitled alpha reads alpha attendance',
  (select count(*) = 1 from public.attendance_records where company_id = 'a0000000-0000-0000-0000-000000000001'));
reset role;

-- 17. audit contains the real actor for the check-in.
select pg_temp.check(17, 'attendance.checked_in audited with real actor',
  (select count(*) = 1 from public.audit_logs
     where action = 'attendance.checked_in'
       and actor_user_id = '11111111-1111-1111-1111-111111111111'
       and company_id = 'a0000000-0000-0000-0000-000000000001'));

-- 16. duplicate check-out rejected (record already checked out).
select pg_temp.check(16, 'duplicate check-out rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    update public.attendance_records set check_out_time = '18:00'
    where company_id = 'a0000000-0000-0000-0000-000000000001' and attendance_date = '2026-07-20'
  $q$));

-- 13/15. duplicate same-day check-in rejected (unique constraint).
select pg_temp.check(13, 'duplicate same-day row / check-in rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-20', '10:00')
  $q$));
select pg_temp.check(15, 'second check-in for same employee/day rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-20', '11:00')
  $q$));

-- 12. company_user (wrong role) cannot mutate.
select pg_temp.check(12, 'company_user cannot insert attendance (role)',
  pg_temp.denied('22222222-2222-2222-2222-222222222222', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-21', '09:00')
  $q$));

-- 5. Alpha admin cannot insert for Beta company_id (matching company_id enforced).
select pg_temp.check(5, 'alpha admin cannot write to beta company_id',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000b1', '2026-07-21', '09:00')
  $q$));

-- 6. Alpha admin cannot attach a Beta employee to an Alpha record (composite FK).
select pg_temp.check(6, 'cross-company employee FK rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000b1', '2026-07-21', '09:00')
  $q$));

-- 14. check-out without check-in rejected.
select pg_temp.check(14, 'check-out before check-in rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_out_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-22', '17:00')
  $q$));

-- 4. Beta admin (no attendance package) cannot insert.
select pg_temp.check(4, 'company without package cannot insert',
  pg_temp.denied('33333333-3333-3333-3333-333333333333', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000b1', '2026-07-21', '09:00')
  $q$));

-- Seed a Beta attendance row (bypass RLS as owner) for read-isolation checks.
insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
  values ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000b1', '2026-07-20', '08:15');

-- 2. Beta admin cannot see Alpha's rows.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check(2, 'beta cannot read alpha attendance',
  (select count(*) = 0 from public.attendance_records where company_id = 'a0000000-0000-0000-0000-000000000001'));
reset role;

-- 3. Beta admin (no package) cannot read its OWN attendance either.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check(3, 'company without package reads zero attendance',
  (select count(*) = 0 from public.attendance_records));
reset role;

-- 7. Inactive membership is denied (reads zero).
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check(7, 'inactive membership reads zero attendance',
  (select count(*) = 0 from public.attendance_records));
reset role;

-- 8. Suspended company (entitled) is denied insert (company-active clause).
select pg_temp.check(8, 'suspended company denied insert',
  pg_temp.denied('44444444-4444-4444-4444-444444444444', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-0000000000c1', '2026-07-21', '09:00')
  $q$));

-- 9. Globally disabled package blocks access.
savepoint s9;
update public.packages set is_active = false where key = 'attendance-management';
select pg_temp.check(9, 'globally disabled package blocks insert',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-23', '09:00')
  $q$));
rollback to savepoint s9;

-- 10. Disabled company package blocks access.
savepoint s10;
update public.company_packages set enabled = false
  where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'attendance-management';
select pg_temp.check(10, 'disabled company package blocks insert',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.attendance_records (company_id, employee_id, attendance_date, check_in_time)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', '2026-07-23', '09:00')
  $q$));
rollback to savepoint s10;

-- 18. Tenant-safe SELECT remains intact after a package release assignment.
--     Assign attendance to Beta via the publish RPC, then confirm each company
--     still sees only its own rows.
savepoint s18;
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('99999999-0000-0000-0000-0000000000a0', 'selected_companies',
  array['a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002']::uuid[]);
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check(18, 'tenant-safe select after release assignment',
  (select count(*) > 0 from public.attendance_records)
  and (select count(*) = count(*) filter (where company_id = 'b0000000-0000-0000-0000-000000000002')
         from public.attendance_records));
reset role;
rollback to savepoint s18;

rollback;
