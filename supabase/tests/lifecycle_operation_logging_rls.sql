-- =============================================================================
-- Lifecycle operation logging — install / update / rollback.
--
-- Proves the three previously-unlogged operations now reach
-- package_lifecycle_operations, that a failed apply leaves a durable `failed`
-- record (and never a `completed` or orphaned `running` one), that the package
-- change itself still rolls back atomically, and that failure reasons stay safe
-- categories rather than raw Postgres text.
--
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/lifecycle_operation_logging_rls.sql
--
-- A clean run ends with 12 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

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

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'LogOne', 'logone', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'LogTwo', 'logtwo', 'active');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super.log@x.com'),
  ('11111111-1111-1111-1111-111111111111', 'logone.admin@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active');

-- Start from a clean log so counts are unambiguous (rolled back with the tx).
delete from public.package_lifecycle_operations;

-- ---------------------------------------------------------------------------
-- 1-3. Company marketplace install is recorded as `install`.
-- ---------------------------------------------------------------------------
select pg_temp.actor('11111111-1111-1111-1111-111111111111');
select public.install_marketplace_extension('document-notes');

select pg_temp.check(1, 'marketplace install writes exactly one lifecycle record',
  (select count(*) = 1 from public.package_lifecycle_operations
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

select pg_temp.check(2, 'it is a completed `install` with the target version and no failure reason',
  (select operation = 'install' and status = 'completed' and source_version is null
          and target_version is not null and failure_reason is null and completed_at is not null
     from public.package_lifecycle_operations
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

select pg_temp.check(3, 'initiated_by and correlation_id are captured',
  (select initiated_by = '11111111-1111-1111-1111-111111111111' and correlation_id is not null
     from public.package_lifecycle_operations
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- ---------------------------------------------------------------------------
-- 4-5. A platform-processed installation over an existing entitlement is an
--      `update`, carrying both versions.
-- ---------------------------------------------------------------------------
insert into public.package_versions (package_key, version, released_at, diagnostic_status)
  values ('document-notes', '2.0.0', now(), 'PASS')
  on conflict (package_key, version) do nothing;
insert into public.package_installations (id, release_id, company_id, package_key, version, status)
  values ('cccccccc-0000-0000-0000-000000000001', null,
          'a0000000-0000-0000-0000-000000000001', 'document-notes', '2.0.0', 'pending');

select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.process_package_installation('cccccccc-0000-0000-0000-000000000001');

select pg_temp.check(4, 'processing over an existing entitlement is logged as `update`',
  (select count(*) = 1 from public.package_lifecycle_operations
    where package_key = 'document-notes' and operation = 'update' and status = 'completed'));

select pg_temp.check(5, 'the update record carries both source and target versions',
  (select source_version = '1.0.0' and target_version = '2.0.0'
     from public.package_lifecycle_operations
    where package_key = 'document-notes' and operation = 'update'));

-- ---------------------------------------------------------------------------
-- 6-7. Rollback is recorded and revokes the entitlement.
-- ---------------------------------------------------------------------------
select public.rollback_package_installation('cccccccc-0000-0000-0000-000000000001');

select pg_temp.check(6, 'rollback writes a completed `rollback` record with a source and no target',
  (select source_version = '2.0.0' and target_version is null and status = 'completed'
     from public.package_lifecycle_operations
    where package_key = 'document-notes' and operation = 'rollback'));

select pg_temp.check(7, 'rollback still revokes the entitlement',
  (select not enabled from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- ---------------------------------------------------------------------------
-- 8-11. Failure path: a suspended company makes the apply phase fail.
-- ---------------------------------------------------------------------------
insert into public.package_installations (id, release_id, company_id, package_key, version, status)
  values ('cccccccc-0000-0000-0000-000000000002', null,
          'b0000000-0000-0000-0000-000000000002', 'document-notes', '1.0.0', 'pending');
update public.companies set status = 'suspended' where id = 'b0000000-0000-0000-0000-000000000002';

select public.process_package_installation('cccccccc-0000-0000-0000-000000000002');

select pg_temp.check(8, 'a failed apply leaves a durable `failed` record',
  (select count(*) = 1 from public.package_lifecycle_operations
    where company_id = 'b0000000-0000-0000-0000-000000000002' and status = 'failed'));

select pg_temp.check(9, 'no `completed` record survives for the rolled-back operation',
  (select count(*) = 0 from public.package_lifecycle_operations
    where company_id = 'b0000000-0000-0000-0000-000000000002' and status = 'completed'));

select pg_temp.check(10, 'no orphaned `running` record is left behind anywhere',
  (select count(*) = 0 from public.package_lifecycle_operations where status = 'running'));

select pg_temp.check(11, 'the package change itself rolled back — no entitlement was granted',
  (select count(*) = 0 from public.company_packages
    where company_id = 'b0000000-0000-0000-0000-000000000002' and package_key = 'document-notes'));

-- ---------------------------------------------------------------------------
-- 12. Failure reasons are safe categories, never raw Postgres text.
-- ---------------------------------------------------------------------------
select pg_temp.check(12, 'failure_reason is a safe category with no database internals',
  (select failure_reason = 'company_not_active'
          and failure_reason !~* '(relation|column|constraint|syntax|postgres)'
     from public.package_lifecycle_operations
    where company_id = 'b0000000-0000-0000-0000-000000000002' and status = 'failed'));

rollback;
