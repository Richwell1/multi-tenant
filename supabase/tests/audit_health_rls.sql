-- =============================================================================
-- Audit Surfaces & System Health — JWT / RLS verification (Phase 5.5)
--
-- platform_audit_log and system_health are platform-plane: a non-admin caller
-- gets nothing. platform_audit_log enriches rows with the actor email (from the
-- otherwise RLS-restricted auth.users) and company name. Self-contained; rolls
-- back.
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/audit_health_rls.sql
--
-- A clean run ends with 9 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'TestOne', 'testone', 'active');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('11111111-1111-1111-1111-111111111111', 'admin.testone@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active');

-- Audit rows: one with an actor + company, one system row (null actor + company).
insert into public.audit_logs (company_id, actor_user_id, action, entity_type) values
  ('a0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'leave.approved', 'leave_request'),
  (null, null, 'release.published', 'package_release');

-- A failed installation drives the health "degraded" signal.
insert into public.packages (key, name, type, is_active) values
  ('h-pkg', 'Health Pkg', 'standard_update', true) on conflict (key) do nothing;
insert into public.package_versions (id, package_key, version, released_at) values
  ('88888888-0000-4000-8000-000000000001', 'h-pkg', '1.0.0', now());
insert into public.package_releases (id, package_version_id, target_mode, status) values
  ('88880000-0000-4000-8000-000000000001', '88888888-0000-4000-8000-000000000001', 'all_companies', 'published');
insert into public.package_installations (release_id, company_id, package_key, version, status) values
  ('88880000-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'h-pkg', '1.0.0', 'failed');

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
-- platform_audit_log (as platform admin unless noted)
-- ---------------------------------------------------------------------------
select pg_temp.actor('55555555-5555-5555-5555-555555555555');

-- 1. Platform admin reads audit rows.
select pg_temp.check(1, 'platform admin reads the audit log',
  (select count(*) >= 2 from public.platform_audit_log(null)));

-- 2. The actor is resolved to a human-readable email.
select pg_temp.check(2, 'actor resolved to email',
  (select actor = 'super@x.com' from public.platform_audit_log(null) where action = 'leave.approved' limit 1));

-- 3. The target resolves to the affected company name.
select pg_temp.check(3, 'target resolves to company name',
  (select target = 'TestOne' from public.platform_audit_log(null) where action = 'leave.approved' limit 1));

-- 4. A system (null-actor) row shows 'system'.
select pg_temp.check(4, 'null actor shown as system',
  (select actor = 'system' from public.platform_audit_log(null) where action = 'release.published' limit 1));

-- 5. The company filter scopes rows (company-less release excluded).
select pg_temp.check(5, 'company filter excludes company-less rows',
  (select count(*) = 0 from public.platform_audit_log(array['a0000000-0000-0000-0000-000000000001']::uuid[])
     where action = 'release.published'));

-- 6. Non-platform-admin gets an empty audit log.
select pg_temp.actor('11111111-1111-1111-1111-111111111111');
select pg_temp.check(6, 'company admin sees no platform audit log',
  (select count(*) = 0 from public.platform_audit_log(null)));

-- ---------------------------------------------------------------------------
-- system_health
-- ---------------------------------------------------------------------------
select pg_temp.actor('55555555-5555-5555-5555-555555555555');

-- 7. Platform admin gets health signals.
select pg_temp.check(7, 'health reports Database Online',
  (select status = 'healthy' from public.system_health() where label = 'Database'));

-- 8. A failed installation degrades the health signal.
select pg_temp.check(8, 'failed installation degrades health',
  (select status = 'degraded' from public.system_health() where label = 'Failed installations'));

-- 9. Non-platform-admin gets no health signals.
select pg_temp.actor('11111111-1111-1111-1111-111111111111');
select pg_temp.check(9, 'company admin sees no system health',
  (select count(*) = 0 from public.system_health()));

rollback;
