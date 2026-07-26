-- =============================================================================
-- Diagnostics & Release Gate — JWT / RLS / gate verification (Phase 5.2)
--
-- Diagnostics are PLATFORM-PLANE (Platform-Admin-only). The release gate blocks
-- publish_package_release when a REQUIRED check is FAIL. Self-contained; rolls
-- back. Run with:
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/diagnostics_rls.sql
--
-- A clean run ends with 14 "ok:" lines.
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

insert into public.packages (key, name, type, is_active) values
  ('gate-pkg', 'Gate Package', 'standard_update', true) on conflict (key) do nothing;
insert into public.package_versions (id, package_key, version, notes, released_at) values
  ('77777777-0000-4000-8000-000000000001', 'gate-pkg', '1.0.0', 'seed', now());

-- A report with all-PASS checks for the version.
insert into public.diagnostic_reports (id, package_version_id, summary, result) values
  ('d0000000-0000-4000-8000-000000000001', '77777777-0000-4000-8000-000000000001', 'gate report', 'PASS');
insert into public.diagnostic_checks (report_id, dimension, status)
select 'd0000000-0000-4000-8000-000000000001', d, 'PASS'
from unnest(enum_range(null::public.diagnostic_dimension)) as d;

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

-- 1. Result derives PASS when all checks pass.
select pg_temp.check(1, 'all-PASS checks derive PASS',
  (select result = 'PASS' from public.diagnostic_reports where id = 'd0000000-0000-4000-8000-000000000001'));

-- 2. package_versions.diagnostic_status is synced from the report result.
select pg_temp.check(2, 'package version diagnostic_status synced to PASS',
  (select diagnostic_status = 'PASS' from public.package_versions where id = '77777777-0000-4000-8000-000000000001'));

-- 3. Platform admin can publish when the version is PASS.
savepoint s3;
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('77777777-0000-4000-8000-000000000001', 'one_company',
  array['a0000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
select pg_temp.check(3, 'publish allowed when diagnostic is PASS', true);
rollback to savepoint s3;

-- 4. A WARN check derives WARN (still publishable — WARN requires review, not block).
savepoint s4;
update public.diagnostic_checks set status = 'WARN'
  where report_id = 'd0000000-0000-4000-8000-000000000001' and dimension = 'security';
select pg_temp.check(4, 'a WARN check derives WARN result',
  (select result = 'WARN' from public.diagnostic_reports where id = 'd0000000-0000-4000-8000-000000000001'));
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('77777777-0000-4000-8000-000000000001', 'one_company',
  array['a0000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
select pg_temp.check(5, 'publish allowed when diagnostic is WARN', true);
rollback to savepoint s4;

-- 6. A required FAIL check derives FAIL and blocks the gate helper.
savepoint s6;
update public.diagnostic_checks set status = 'FAIL'
  where report_id = 'd0000000-0000-4000-8000-000000000001' and dimension = 'security';
select pg_temp.check(6, 'a required FAIL check derives FAIL result',
  (select result = 'FAIL' from public.diagnostic_reports where id = 'd0000000-0000-4000-8000-000000000001'));
select pg_temp.check(7, 'version_release_blocked true on required FAIL',
  public.version_release_blocked('77777777-0000-4000-8000-000000000001'));

-- 8. Publish is blocked when a required check is FAIL.
select pg_temp.check(8, 'publish blocked by required FAIL',
  pg_temp.denied('55555555-5555-5555-5555-555555555555', $q$
    select public.publish_package_release('77777777-0000-4000-8000-000000000001', 'one_company',
      array['a0000000-0000-0000-0000-000000000001']::uuid[])
  $q$));
rollback to savepoint s6;

-- 9. A NON-required FAIL check does not block release.
savepoint s9;
update public.diagnostic_checks set status = 'FAIL', required = false
  where report_id = 'd0000000-0000-4000-8000-000000000001' and dimension = 'test_evidence';
select pg_temp.check(9, 'non-required FAIL does not block the gate',
  not public.version_release_blocked('77777777-0000-4000-8000-000000000001'));
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('77777777-0000-4000-8000-000000000001', 'one_company',
  array['a0000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
select pg_temp.check(10, 'publish allowed despite a non-required FAIL', true);
rollback to savepoint s9;

-- 11. Company admin cannot read diagnostics (platform-plane).
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(11, 'company admin reads zero diagnostics',
  (select count(*) = 0 from public.diagnostic_reports));
reset role;

-- 12. Company admin cannot insert a diagnostic report.
select pg_temp.check(12, 'company admin cannot create diagnostic',
  pg_temp.denied('11111111-1111-1111-1111-111111111111', $q$
    insert into public.diagnostic_reports (package_version_id, summary)
    values ('77777777-0000-4000-8000-000000000001', 'x')
  $q$));

-- 13. The completed request_records.diagnostic_id FK links a request to a report.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
insert into public.request_records (id, company_id, source_email_reference, title, request_type, description, diagnostic_id)
  values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-000000000001',
          'EML', 'linked', 'New Package', 'desc', 'd0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.check(13, 'request links to diagnostic via diagnostic_id FK',
  (select diagnostic_id = 'd0000000-0000-4000-8000-000000000001'
     from public.request_records where id = 'c0000000-0000-4000-8000-000000000001'));

-- 14. Audit: report creation is recorded with the real actor.
select pg_temp.check(14, 'diagnostic.created audited',
  (select count(*) >= 1 from public.audit_logs
     where action = 'diagnostic.created' and entity_type = 'diagnostic_report'));

rollback;
