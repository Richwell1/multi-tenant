-- =============================================================================
-- Leave Management — JWT / RLS security verification (Phase 4.3A)
--
-- Self-contained: seeds two tenants, users, memberships, package assignments and
-- employees inside a transaction, exercises the policies as each JWT, then rolls
-- back. Run with:
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/leave_rls.sql
--
-- Every scenario prints "ok: <n> - <name>" via a helper that raises on failure,
-- so a clean run ends with 14 "ok:" lines and COMMIT-free ROLLBACK.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Fixtures ------------------------------------------------------------------
-- Companies: testone (active, entitled), testtwo (active, NOT entitled), testthree
-- (suspended, entitled) — to prove the company-active clause.
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne', 'testone', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'TestTwo',  'testtwo',  'active'),
  ('c0000000-0000-0000-0000-000000000003', 'TestThree', 'testthree', 'suspended');

-- Users: an admin + a plain user for testone, an admin for testtwo and testthree, and a
-- platform super admin.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin.testone@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'user.testone@x.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin.testtwo@x.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin.testthree@x.com'),
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('66666666-6666-6666-6666-666666666666', 'inactive.testone@x.com');

insert into public.platform_admins (user_id) values
  ('55555555-5555-5555-5555-555555555555');

insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'company_user',  'active'),
  ('a0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'company_admin', 'inactive'),
  ('b0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'company_admin', 'active'),
  ('c0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'company_admin', 'active');

-- Packages: leave-management globally active; entitle testone and testthree (testthree is
-- suspended so the assignment must still be denied). TestTwo is NOT entitled.
insert into public.packages (key, name, type, is_active) values
  ('leave-management', 'Leave Management', 'standard_update', true)
on conflict (key) do update set is_active = excluded.is_active;

insert into public.company_packages (company_id, package_key, enabled) values
  ('a0000000-0000-0000-0000-000000000001', 'leave-management', true),
  ('c0000000-0000-0000-0000-000000000003', 'leave-management', true);

-- Employees (same-company FK targets).
insert into public.employees (id, company_id, employee_number, full_name) values
  ('e0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-000000000001', 'A-001', 'TestOne One'),
  ('e0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-000000000002', 'B-001', 'TestTwo One');

-- Helper: assert a boolean, print an ok/fail line, raise on failure.
create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- Helper: run a statement as a given authenticated user, return true if RLS or a
-- constraint blocked it. Switches to the `authenticated` role so policies apply
-- (postgres has BYPASSRLS). On error the subtransaction rolls back the role too.
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

-- Convenience to authenticate as a uid for SELECT-count assertions.
create or replace function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end; $$;

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------

-- 1. TestOne admin (entitled + role) can INSERT a pending request.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
  values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', 'annual', '2026-08-01', '2026-08-05');
reset role;
select pg_temp.check(1, 'testone admin can create request', true);

-- 2. TestOne admin sees exactly their company's request.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(2, 'testone admin reads own-company request',
  (select count(*) = 1 from public.leave_requests where company_id = 'a0000000-0000-0000-0000-000000000001'));
reset role;

-- 3. TestTwo admin (active member, NOT entitled) cannot READ testone rows AND sees none of their own.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check(3, 'testtwo admin (no package) reads zero leave rows',
  (select count(*) = 0 from public.leave_requests));
reset role;

-- 4. TestTwo admin cannot INSERT (no entitlement).
select pg_temp.check(4, 'testtwo admin (no package) denied insert',
  pg_temp.denied('33333333-3333-3333-3333-333333333333', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000b1', 'sick', '2026-08-01', '2026-08-02')
  $q$));

-- 5. TestOne PLAIN USER (entitled company, wrong role) can READ but cannot INSERT.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(5, 'testone company_user can read leave',
  (select count(*) = 1 from public.leave_requests));
reset role;

-- 6. TestOne plain user denied INSERT (role gate on writes).
select pg_temp.check(6, 'testone company_user denied insert (role)',
  pg_temp.denied('22222222-2222-2222-2222-222222222222', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', 'sick', '2026-08-10', '2026-08-11')
  $q$));

-- 7. Inactive testone admin (membership inactive) is denied read (sees zero).
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select pg_temp.check(7, 'inactive membership reads zero leave rows',
  (select count(*) = 0 from public.leave_requests));
reset role;

-- 8. TestThree admin (entitled but SUSPENDED company) denied insert (company-active clause).
select pg_temp.check(8, 'suspended company denied insert',
  pg_temp.denied('44444444-4444-4444-4444-444444444444', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('c0000000-0000-0000-0000-000000000003',
            (select id from public.employees where company_id='c0000000-0000-0000-0000-000000000003' limit 1),
            'annual', '2026-08-01', '2026-08-02')
  $q$));

-- 9. Cross-tenant: testone admin cannot INSERT into testtwo (matching company_id enforced).
select pg_temp.check(9, 'testone admin cannot write to testtwo company_id',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-0000000000b1', 'sick', '2026-08-01', '2026-08-02')
  $q$));

-- 10. Same-company FK: TestOne admin cannot attach a TestTwo employee to a TestOne request.
select pg_temp.check(10, 'cross-company employee FK rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000b1', 'annual', '2026-08-01', '2026-08-02')
  $q$));

-- 11. date-order check: end before start rejected.
select pg_temp.check(11, 'end-before-start rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.leave_requests (company_id, employee_id, leave_type, start_date, end_date)
    values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000a1', 'annual', '2026-08-05', '2026-08-01')
  $q$));

-- 12. Valid transition: testone admin approves the pending request; reviewer stamped from auth.uid().
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.leave_requests set status = 'approved'
  where company_id = 'a0000000-0000-0000-0000-000000000001' and status = 'pending';
reset role;
select pg_temp.check(12, 'approve stamps reviewer from auth.uid()',
  (select reviewed_by = '11111111-1111-1111-1111-111111111111'
     from public.leave_requests
    where company_id = 'a0000000-0000-0000-0000-000000000001' limit 1));

-- 13. Invalid transition: approved → rejected rejected by the status machine.
select pg_temp.check(13, 'approved->rejected transition rejected',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    update public.leave_requests set status = 'rejected'
    where company_id = 'a0000000-0000-0000-0000-000000000001' and status = 'approved'
  $q$));

-- 14. Audit: the approval wrote a leave.approved row with the real actor.
select pg_temp.check(14, 'leave.approved audited with real actor',
  (select count(*) = 1 from public.audit_logs
     where action = 'leave.approved'
       and entity_type = 'leave_request'
       and actor_user_id = '11111111-1111-1111-1111-111111111111'
       and company_id = 'a0000000-0000-0000-0000-000000000001'));

rollback;
