-- =============================================================================
-- Usage Analytics — JWT / RLS aggregation verification (Phase 5.4)
--
-- usage_metrics() aggregates audit_logs by action-prefix module. It is platform-
-- plane: a non-admin caller gets an empty result; an optional company filter
-- scopes the aggregate. Self-contained; rolls back.
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/usage_analytics_rls.sql
--
-- A clean run ends with 7 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Isolate the aggregate from pre-existing seed audit rows (rolled back with the tx).
delete from public.audit_logs;

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha', 'alpha', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta',  'beta',  'active');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('11111111-1111-1111-1111-111111111111', 'admin.alpha@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active');

-- Audit trail to aggregate: leave (alpha×2, beta×1), employee (alpha×1),
-- release (company-less×1 — must not inflate companies_using).
insert into public.audit_logs (company_id, actor_user_id, action, entity_type) values
  ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'leave.approved',   'leave_request'),
  ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'leave.requested',  'leave_request'),
  ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'leave.requested',  'leave_request'),
  ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'employee.created', 'employee'),
  (null,                                    '55555555-5555-5555-5555-555555555555', 'release.published','package_release');

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

-- ---------------------------------------------------------------------------
-- Scenarios (as platform admin unless noted)
-- ---------------------------------------------------------------------------
select pg_temp.actor('55555555-5555-5555-5555-555555555555');

-- 1. Modules are grouped by action prefix.
select pg_temp.check(1, 'aggregates three modules (leave, employee, release)',
  (select count(*) = 3 from public.usage_metrics(null)));

-- 2. Action counts are correct per module.
select pg_temp.check(2, 'leave action_count = 3',
  (select action_count = 3 from public.usage_metrics(null) where module = 'leave'));

-- 3. companies_using counts distinct companies (leave spans alpha + beta).
select pg_temp.check(3, 'leave companies_using = 2',
  (select companies_using = 2 from public.usage_metrics(null) where module = 'leave'));

-- 4. Company-less actions do not inflate companies_using.
select pg_temp.check(4, 'release companies_using = 0 (null company)',
  (select companies_using = 0 from public.usage_metrics(null) where module = 'release'));

-- 5. The company filter scopes the aggregate (alpha-only → leave count drops to 2).
select pg_temp.check(5, 'company filter scopes leave to alpha (2)',
  (select action_count = 2 from public.usage_metrics(array['a0000000-0000-0000-0000-000000000001']::uuid[])
     where module = 'leave'));

-- 6. Ordering: the busiest module (leave) is first.
select pg_temp.check(6, 'busiest module first',
  (select module from public.usage_metrics(null) limit 1) = 'leave');

-- 7. Non-platform-admin gets an empty result (self-gated).
select pg_temp.actor('11111111-1111-1111-1111-111111111111');
select pg_temp.check(7, 'company admin sees no usage analytics',
  (select count(*) = 0 from public.usage_metrics(null)));

rollback;
