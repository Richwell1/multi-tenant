-- =============================================================================
-- Request Records — JWT / RLS security verification (Phase 5.1)
--
-- request_records is PLATFORM-PLANE data: only Platform Admins may read or write
-- it (internal notes, email refs, pipeline status). The lifecycle is a DB-
-- enforced state machine. Self-contained; rolls back. Run with:
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/request_records_rls.sql
--
-- A clean run ends with 10 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne', 'testone', 'active');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('11111111-1111-1111-1111-111111111111', 'admin.testone@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'user.testone@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');

insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'company_user',  'active');

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

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------

-- 1. Platform admin can create a request record.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
insert into public.request_records (id, company_id, source_email_reference, title, request_type, description)
  values ('d0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000001',
          'EML-1', 'Leave tracking', 'New Package', 'Needs leave management');
reset role;
select pg_temp.check(1, 'platform admin can create request', true);

-- 2. Platform admin reads all request records.
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select pg_temp.check(2, 'platform admin reads requests',
  (select count(*) = 1 from public.request_records));
reset role;

-- 3. Company admin (not platform) reads none (platform-plane isolation).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(3, 'company admin reads zero requests',
  (select count(*) = 0 from public.request_records));
reset role;

-- 4. Company admin cannot insert.
select pg_temp.check(4, 'company admin cannot create request',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.request_records (company_id, source_email_reference, title, request_type, description)
    values ('a0000000-0000-0000-0000-000000000001', 'EML-x', 'x', 'y', 'z')
  $q$));

-- 5. Company user cannot update: RLS filters the row out, so the UPDATE matches
--    zero rows (no error) and the record is left untouched.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
update public.request_records set status = 'under_review'
  where id = 'd0000000-0000-0000-0000-0000000000f1';
reset role;
select pg_temp.check(5, 'company user update is a no-op (RLS)',
  (select status = 'received' from public.request_records where id = 'd0000000-0000-0000-0000-0000000000f1'));

-- 6. Platform admin performs a valid transition (received → under_review).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
update public.request_records set status = 'under_review'
  where id = 'd0000000-0000-0000-0000-0000000000f1';
reset role;
select pg_temp.check(6, 'valid transition received->under_review',
  (select status = 'under_review' from public.request_records where id = 'd0000000-0000-0000-0000-0000000000f1'));

-- 7. Invalid transition is rejected (under_review → released skips the pipeline).
select pg_temp.check(7, 'invalid transition under_review->released rejected',
  pg_temp.denied('55555555-5555-5555-5555-555555555555', $q$
    update public.request_records set status = 'released'
    where id = 'd0000000-0000-0000-0000-0000000000f1'
  $q$));

-- 8. 'closed' is reachable from an active state.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
update public.request_records set status = 'closed'
  where id = 'd0000000-0000-0000-0000-0000000000f1';
reset role;
select pg_temp.check(8, 'active request can be closed',
  (select status = 'closed' from public.request_records where id = 'd0000000-0000-0000-0000-0000000000f1'));

-- 9. Terminal 'closed' cannot transition further.
select pg_temp.check(9, 'closed is terminal',
  pg_temp.denied('55555555-5555-5555-5555-555555555555', $q$
    update public.request_records set status = 'under_review'
    where id = 'd0000000-0000-0000-0000-0000000000f1'
  $q$));

-- 10. Audit trail: creation + status changes recorded with the real actor.
select pg_temp.check(10, 'request history audited with real actor',
  (select count(*) >= 3 from public.audit_logs
     where entity_type = 'request_record'
       and actor_user_id = '55555555-5555-5555-5555-555555555555'
       and action in ('request.created', 'request.status_changed')));

rollback;
