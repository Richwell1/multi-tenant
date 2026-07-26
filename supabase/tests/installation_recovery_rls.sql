-- =============================================================================
-- Installation Monitoring & Recovery — JWT / RLS / RPC verification (Phase 5.3)
--
-- Recovery is Platform-Admin-only and keeps entitlements consistent: retry
-- restores a FAILED install (re-enables the assignment); rollback revokes an
-- INSTALLED package (disables the assignment). Self-contained; rolls back.
--   docker exec -i supabase_db_Demo psql -U postgres -d postgres < supabase/tests/installation_recovery_rls.sql
--
-- A clean run ends with 12 "ok:" lines.
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
  ('rec-a', 'Recover A', 'standard_update', true),
  ('rec-b', 'Recover B', 'standard_update', true) on conflict (key) do nothing;
insert into public.package_versions (id, package_key, version, released_at) values
  ('99999999-0000-4000-8000-00000000000a', 'rec-a', '1.0.0', now()),
  ('99999999-0000-4000-8000-00000000000b', 'rec-b', '1.0.0', now());
insert into public.package_releases (id, package_version_id, target_mode, status) values
  ('11110000-0000-4000-8000-00000000000a', '99999999-0000-4000-8000-00000000000a', 'all_companies', 'published'),
  ('11110000-0000-4000-8000-00000000000b', '99999999-0000-4000-8000-00000000000b', 'all_companies', 'published');

-- One FAILED install (rec-a, assignment disabled) and one INSTALLED (rec-b, enabled).
insert into public.package_installations (id, release_id, company_id, package_key, version, status) values
  ('a5511110-0000-4000-8000-00000000000a', '11110000-0000-4000-8000-00000000000a',
   'a0000000-0000-0000-0000-000000000001', 'rec-a', '1.0.0', 'failed'),
  ('a5511110-0000-4000-8000-00000000000b', '11110000-0000-4000-8000-00000000000b',
   'a0000000-0000-0000-0000-000000000001', 'rec-b', '1.0.0', 'installed');
insert into public.company_packages (company_id, package_key, enabled, status) values
  ('a0000000-0000-0000-0000-000000000001', 'rec-a', false, 'assigned'),
  ('a0000000-0000-0000-0000-000000000001', 'rec-b', true,  'installed');

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

-- true if the (owner-run) statement raised; used to prove the transition trigger.
create or replace function pg_temp.raises(stmt text) returns boolean
language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end; $$;

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------

-- 1. Rollback rejects a non-installed (failed) install.
select pg_temp.check(1, 'rollback rejected for a failed install',
  pg_temp.denied('55555555-5555-5555-5555-555555555555',
    $q$ select public.rollback_package_installation('a5511110-0000-4000-8000-00000000000a') $q$));

-- 2. Company admin (not platform) cannot retry.
select pg_temp.check(2, 'company admin cannot retry (authz)',
  pg_temp.denied('11111111-1111-1111-1111-111111111111',
    $q$ select public.retry_package_installation('a5511110-0000-4000-8000-00000000000a') $q$));

-- 3. Platform admin retries the failed install → installed.
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.retry_package_installation('a5511110-0000-4000-8000-00000000000a');
reset role;
select pg_temp.check(3, 'retry recovers a failed install to installed',
  (select status = 'installed' from public.package_installations where id = 'a5511110-0000-4000-8000-00000000000a'));

-- 4. Retry restored the tenant entitlement.
select pg_temp.check(4, 'retry re-enables the company package',
  public.company_has_package('a0000000-0000-0000-0000-000000000001', 'rec-a'));

-- 5. Retrying an already-installed record is rejected.
select pg_temp.check(5, 'retry rejected for a non-failed install',
  pg_temp.denied('55555555-5555-5555-5555-555555555555',
    $q$ select public.retry_package_installation('a5511110-0000-4000-8000-00000000000b') $q$));

-- 6. Company admin cannot roll back.
select pg_temp.check(6, 'company admin cannot rollback (authz)',
  pg_temp.denied('11111111-1111-1111-1111-111111111111',
    $q$ select public.rollback_package_installation('a5511110-0000-4000-8000-00000000000b') $q$));

-- 7. Platform admin rolls back the installed package → rolled_back.
select pg_temp.actor('55555555-5555-5555-5555-555555555555');
select public.rollback_package_installation('a5511110-0000-4000-8000-00000000000b');
reset role;
select pg_temp.check(7, 'rollback sets rolled_back',
  (select status = 'rolled_back' from public.package_installations where id = 'a5511110-0000-4000-8000-00000000000b'));

-- 8. Rollback revoked the tenant entitlement (immediate loss of access).
select pg_temp.check(8, 'rollback disables the company package',
  not public.company_has_package('a0000000-0000-0000-0000-000000000001', 'rec-b'));

-- 9. The state machine rejects an illegal direct transition (rolled_back → installed).
select pg_temp.check(9, 'illegal installation transition rejected by trigger',
  pg_temp.raises(
    $q$ update public.package_installations set status = 'installed'
        where id = 'a5511110-0000-4000-8000-00000000000b' $q$));

-- 10. Tenant-safe monitoring: the company member reads its own installs.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(10, 'company member reads own installations',
  (select count(*) = 2 from public.package_installations
     where company_id = 'a0000000-0000-0000-0000-000000000001'));
reset role;

-- 11. Retry is audited with the real actor.
select pg_temp.check(11, 'installation.retried audited',
  (select count(*) = 1 from public.audit_logs
     where action = 'installation.retried' and actor_user_id = '55555555-5555-5555-5555-555555555555'));

-- 12. Rollback is audited with the real actor.
select pg_temp.check(12, 'installation.rolled_back audited',
  (select count(*) = 1 from public.audit_logs
     where action = 'installation.rolled_back' and actor_user_id = '55555555-5555-5555-5555-555555555555'));

rollback;
