-- =============================================================================
-- Package release publishing — JWT / RLS / RPC verification (Phase 4.2)
--
-- Reconstructed as a reproducible suite (previously run ad-hoc). Self-contained:
-- seeds packages/versions/companies/users in a transaction, exercises the
-- Platform-Admin-only publish RPC + read-only RLS, then rolls back. Run with:
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/package_release_rls.sql
--
-- A clean run ends with 10 "ok:" lines.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- Fixtures ------------------------------------------------------------------
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha', 'alpha', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta',  'beta',  'active'),
  ('c0000000-0000-0000-0000-000000000003', 'Gamma', 'gamma', 'suspended');

insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'super@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'user.alpha@x.com');

insert into public.platform_admins (user_id) values
  ('55555555-5555-5555-5555-555555555555');

insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'company_user', 'active');

-- Packages of each relevant classification (all globally active).
insert into public.packages (key, name, type, is_active) values
  ('pkg-std',    'Std Update',   'standard_update',       true),
  ('pkg-priv',   'Private Cust', 'private_customization', true),
  ('pkg-shared', 'Shared Ext',   'shared_extension',      true)
on conflict (key) do nothing;

insert into public.package_versions (id, package_key, version, notes, released_at) values
  ('11111111-0000-0000-0000-0000000000f1', 'pkg-std',    '1.0.0', 'std',    now()),
  ('11111111-0000-0000-0000-0000000000f2', 'pkg-priv',   '1.0.0', 'priv',   now()),
  ('11111111-0000-0000-0000-0000000000f3', 'pkg-shared', '1.0.0', 'shared', now())
on conflict (package_key, version) do nothing;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

-- Run a statement as an authenticated user; true if it raised (RLS/RPC blocked).
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

-- Authenticate for RLS-scoped SELECT assertions.
create or replace function pg_temp.as_user(uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end; $$;

-- Set the JWT actor for RPC calls (RPC self-authorizes via is_platform_admin).
create or replace function pg_temp.actor(uid text) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)::void;
$$;

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------

-- 1. A non-platform-admin cannot publish (RPC self-authorization).
select pg_temp.check(1, 'company_user cannot publish',
  pg_temp.denied('22222222-2222-2222-2222-222222222222',
    $q$ select public.publish_package_release('11111111-0000-0000-0000-0000000000f1','all_companies') $q$));

-- 2. private_customization → all_companies is rejected (classification rule).
select pg_temp.check(2, 'private customization rejected for all_companies',
  pg_temp.denied('55555555-5555-5555-5555-555555555555',
    $q$ select public.publish_package_release('11111111-0000-0000-0000-0000000000f2','all_companies') $q$));

-- 3. shared_extension → one_company is rejected (classification rule).
select pg_temp.check(3, 'shared extension rejected for one_company',
  pg_temp.denied('55555555-5555-5555-5555-555555555555',
    $q$ select public.publish_package_release('11111111-0000-0000-0000-0000000000f3','one_company',
          array['a0000000-0000-0000-0000-000000000001']::uuid[]) $q$));

-- 4. selected_companies with a single target is rejected (needs >= 2).
select pg_temp.check(4, 'selected_companies requires two targets',
  pg_temp.denied('55555555-5555-5555-5555-555555555555',
    $q$ select public.publish_package_release('11111111-0000-0000-0000-0000000000f1','selected_companies',
          array['a0000000-0000-0000-0000-000000000001']::uuid[]) $q$));

-- 5. Platform admin publishes std → all_companies; only the 2 ACTIVE companies
--    get installations (gamma is suspended and excluded).
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('11111111-0000-0000-0000-0000000000f1', 'all_companies');
reset role;
select pg_temp.check(5, 'all_companies installs only active companies (2)',
  (select count(*) = 2 from public.package_installations pi
     join public.package_releases pr on pr.id = pi.release_id
    where pi.package_key = 'pkg-std'));

-- 6. Entitlement upsert: both active companies now HAVE the package (enabled ∧ active).
select pg_temp.check(6, 'publish upserts enabled company_packages',
  public.company_has_package('a0000000-0000-0000-0000-000000000001', 'pkg-std')
  and public.company_has_package('b0000000-0000-0000-0000-000000000002', 'pkg-std'));

-- 7. private_customization → one_company (single active target) succeeds.
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.publish_package_release('11111111-0000-0000-0000-0000000000f2', 'one_company',
  array['a0000000-0000-0000-0000-000000000001']::uuid[]);
reset role;
select pg_temp.check(7, 'private customization installs to exactly one company',
  (select count(*) = 1 from public.package_installations where package_key = 'pkg-priv'));

-- 8. Tenant-safe installations: alpha member sees only alpha's install rows.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(8, 'company member sees only own-company installations',
  (select count(*) = count(*) filter (where company_id = 'a0000000-0000-0000-0000-000000000001')
     from public.package_installations)
  and (select count(*) > 0 from public.package_installations));
reset role;

-- 9. Releases/targets are platform-plane: a company member reads none.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(9, 'company member cannot read releases (platform-plane)',
  (select count(*) = 0 from public.package_releases));
reset role;

-- 10. Audit: a release.published row exists with the real platform-admin actor.
select pg_temp.check(10, 'release.published audited with real actor',
  (select count(*) >= 1 from public.audit_logs
     where action = 'release.published'
       and actor_user_id = '55555555-5555-5555-5555-555555555555'));

rollback;
