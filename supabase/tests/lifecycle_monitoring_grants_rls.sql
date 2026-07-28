-- =============================================================================
-- Lifecycle Monitoring — relationship, privilege, and RLS verification.
--
-- Regression cover for the Platform Admin `/admin/lifecycle` production failure:
-- the monitoring query embeds `packages(name)`, which PostgREST resolves ONLY
-- from a declared foreign key. The key was missing, so the request failed with
-- 400 PGRST200 at schema-cache parse time — before privileges or RLS were ever
-- consulted. Grants and policies were correct all along; checks 1-2 are the ones
-- that would have caught the real defect.
--
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/lifecycle_monitoring_grants_rls.sql
--
-- A clean run ends with 11 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- Count visible operations as a given user, under the `authenticated` role so
-- RLS is actually enforced (it is bypassed for the superuser running this file).
create or replace function pg_temp.ops_visible(uid text) returns int
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.package_lifecycle_operations;
  execute 'reset role';
  return n;
end; $$;

create or replace function pg_temp.errored(stmt text) returns boolean
language plpgsql as $$
begin
  execute stmt; return false;
exception when others then return true;
end; $$;

-- Run a statement as a given user under the `authenticated` role.
create or replace function pg_temp.errored_as(uid text, stmt text) returns boolean
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

-- Count visible operations as an unauthenticated caller (role `anon`, no sub).
create or replace function pg_temp.ops_visible_anon() returns int
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from public.package_lifecycle_operations;
  execute 'reset role';
  return n;
end; $$;

-- Fixtures: two tenants, one platform admin, one company admin, one outsider.
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha LM', 'alpha-lm', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta LM',  'beta-lm',  'active');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super.lm@x.com'),
  ('11111111-1111-1111-1111-111111111111', 'alpha.admin.lm@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'outsider.lm@x.com');

insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'company_admin', 'active');

-- Monitoring rows spanning both tenants (2 for Alpha, 1 for Beta).
insert into public.package_lifecycle_operations
  (company_id, package_key, operation, status, source_version, target_version, completed_at) values
  ('a0000000-0000-0000-0000-000000000001', 'document-notes', 'install',   'completed', null,    '1.0.0', now()),
  ('a0000000-0000-0000-0000-000000000001', 'document-notes', 'uninstall', 'completed', '1.0.0', null,    now()),
  ('b0000000-0000-0000-0000-000000000002', 'document-notes', 'install',   'completed', null,    '1.0.0', now());

-- ---------------------------------------------------------------------------
-- 1-2. The PostgREST embed contract: declared foreign keys to the catalog.
-- ---------------------------------------------------------------------------
select pg_temp.check(1, 'package_lifecycle_operations declares an FK to packages (enables packages(name) embed)',
  (select exists (
     select 1 from pg_constraint c
     join pg_class t  on t.oid  = c.conrelid
     join pg_class rt on rt.oid = c.confrelid
     where c.contype = 'f'
       and t.relname  = 'package_lifecycle_operations'
       and rt.relname = 'packages')));

select pg_temp.check(2, 'package_restore_points declares an FK to packages',
  (select exists (
     select 1 from pg_constraint c
     join pg_class t  on t.oid  = c.conrelid
     join pg_class rt on rt.oid = c.confrelid
     where c.contype = 'f'
       and t.relname  = 'package_restore_points'
       and rt.relname = 'packages')));

-- ---------------------------------------------------------------------------
-- 3-5. Reachability and write protection.
--
-- NOTE ON ENVIRONMENT DRIFT: privileges are evaluated before RLS, but they are
-- NOT identical across environments. The local Supabase image applies blanket
-- default privileges in `public` to anon/authenticated, whereas the hosted
-- project does not (an anon read there returns 42501). Asserting the *absence*
-- of a privilege therefore passes on hosted and fails locally for reasons that
-- have nothing to do with this application. So we assert the behaviour that must
-- hold in BOTH environments — RLS is the authorization boundary either way — and
-- assert a privilege only where it is required to exist (SELECT for
-- authenticated, which the 20260802010000 grant guarantees).
-- ---------------------------------------------------------------------------
select pg_temp.check(3, 'authenticated holds the SELECT grant the monitoring read depends on',
  has_table_privilege('authenticated', 'public.package_lifecycle_operations', 'SELECT'));

select pg_temp.check(4, 'an unauthenticated (anon) caller sees no lifecycle operations',
  pg_temp.ops_visible_anon() = 0);

select pg_temp.check(5, 'a company admin cannot insert into the log directly (no write policy; RPCs own writes)',
  pg_temp.errored_as('11111111-1111-1111-1111-111111111111',
    $$insert into public.package_lifecycle_operations (company_id, package_key, operation)
      values ('a0000000-0000-0000-0000-000000000001', 'document-notes', 'install')$$));

-- A policy-less DELETE is not an error under RLS — it simply matches no rows.
-- Assert the outcome (nothing removed) rather than an exception.
select pg_temp.errored_as('11111111-1111-1111-1111-111111111111',
  $$delete from public.package_lifecycle_operations$$);
select pg_temp.check(6, 'a company admin deleting the log removes nothing (all 3 rows survive)',
  (select count(*) = 3 from public.package_lifecycle_operations));

-- ---------------------------------------------------------------------------
-- 7-9. RLS remains the authorization boundary.
-- ---------------------------------------------------------------------------
select pg_temp.check(7, 'platform admin lists lifecycle operations across every company (3)',
  pg_temp.ops_visible('55555555-5555-5555-5555-555555555555') = 3);

select pg_temp.check(8, 'company admin sees only their own company''s operations (2), never the global log',
  pg_temp.ops_visible('11111111-1111-1111-1111-111111111111') = 2);

select pg_temp.check(9, 'a user with no membership sees nothing (0)',
  pg_temp.ops_visible('22222222-2222-2222-2222-222222222222') = 0);

-- ---------------------------------------------------------------------------
-- 10-11. The foreign key is real integrity, not just an embed hint.
-- ---------------------------------------------------------------------------
select pg_temp.check(10, 'an operation cannot reference a package key absent from the catalog',
  pg_temp.errored($$insert into public.package_lifecycle_operations (company_id, package_key, operation)
                    values ('a0000000-0000-0000-0000-000000000001', 'no-such-package', 'install')$$));

-- ON DELETE RESTRICT: a catalog package cannot be deleted out from under its own
-- audit trail. Uses a package with no other referencing rows, so only the new FK
-- can be responsible for the refusal.
insert into public.packages (key, name, type) values ('lm-probe-pkg', 'LM Probe', 'shared_extension');
insert into public.package_lifecycle_operations (company_id, package_key, operation)
  values ('a0000000-0000-0000-0000-000000000001', 'lm-probe-pkg', 'install');

select pg_temp.check(11, 'deleting a catalog package with lifecycle history is restricted',
  pg_temp.errored($$delete from public.packages where key = 'lm-probe-pkg'$$));

rollback;
