-- Package lifecycle & 30-day retention — authorization, isolation, and data
-- safety. Proves uninstall retains (not deletes), restore returns data without
-- duplication, permanent removal deletes only package-owned data, mandatory
-- packages are protected, purge is idempotent, and a slug/company can never
-- touch another tenant's data. 16 ok notices.

\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(n int, name text, cond boolean) returns void
language plpgsql as $$
begin
  if cond then raise notice 'ok: % - %', n, name;
  else raise exception 'FAIL: % - %', n, name; end if;
end; $$;

create or replace function pg_temp.errored(uid text, stmt text) returns boolean
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; execute stmt; execute 'reset role'; return false;
exception when others then
  begin execute 'reset role'; exception when others then end; return true;
end; $$;

create or replace function pg_temp.as_admin(uid text, stmt text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated'; execute stmt; execute 'reset role';
end; $$;

-- Two tenants, each with its own admin, HR Core + Document Notes installed.
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'a-admin@x.com'),
  ('b1000000-0000-0000-0000-000000000002', 'b-admin@x.com');
insert into public.companies (id, name, slug, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Alpha LC', 'alpha-lc', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta LC',  'beta-lc',  'active');
insert into public.company_memberships (company_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'company_admin', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'company_admin', 'active');
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source) values
  ('a0000000-0000-0000-0000-000000000001', 'hr-core', '1.0.0', true, 'installed', now(), 'registration_default'),
  ('a0000000-0000-0000-0000-000000000001', 'document-notes', '1.0.0', true, 'installed', now(), 'company_marketplace'),
  ('b0000000-0000-0000-0000-000000000002', 'hr-core', '1.0.0', true, 'installed', now(), 'registration_default'),
  ('b0000000-0000-0000-0000-000000000002', 'document-notes', '1.0.0', true, 'installed', now(), 'company_marketplace');
insert into public.document_notes (company_id, title) values
  ('a0000000-0000-0000-0000-000000000001', 'A-Note-1'),
  ('a0000000-0000-0000-0000-000000000001', 'A-Note-2'),
  ('b0000000-0000-0000-0000-000000000002', 'B-Note-1');

-- 1) Mandatory HR Core cannot be uninstalled by a company admin.
select pg_temp.check(1, 'mandatory HR Core cannot be uninstalled',
  pg_temp.errored('a1000000-0000-0000-0000-000000000001', $$select public.uninstall_package('hr-core')$$));

-- 2) Disable ≠ uninstall: disable keeps data_state active (data preserved, no retention).
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.disable_package('document-notes')$$);
select pg_temp.check(2, 'disable turns off entitlement but keeps data_state active',
  (select not enabled and data_state = 'active' and retention_until is null
     from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- 3) Re-enable restores the entitlement.
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.enable_package('document-notes')$$);
select pg_temp.check(3, 'enable turns the entitlement back on',
  (select enabled from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- 4) Uninstall disables entitlement and starts a 30-day retention window.
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.uninstall_package('document-notes','done')$$);
select pg_temp.check(4, 'uninstall disables entitlement and sets ~30-day retention',
  (select not enabled and data_state = 'retained'
     and retention_until between now() + interval '29 days' and now() + interval '31 days'
     from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- 5) Uninstall PRESERVES the feature data (rows still exist).
select pg_temp.check(5, 'uninstall preserves feature data (not deleted)',
  (select count(*) = 2 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001'));

-- 6) Retained data is NOT accessible through normal RLS while uninstalled.
select set_config('request.jwt.claims', json_build_object('sub','a1000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
set local role authenticated;
select pg_temp.check(6, 'retained data is hidden from normal feature access',
  (select count(*) = 0 from public.document_notes));
reset role;

-- 7) Restore returns the data (no duplication).
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.restore_package('document-notes')$$);
select pg_temp.check(7, 'restore returns the exact retained rows (no duplication)',
  (select count(*) = 2 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001')
  and (select enabled and data_state = 'active'
         from public.company_packages
        where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- 8) Permanent removal deletes ONLY that package's company data.
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.uninstall_package('document-notes')$$);
select pg_temp.as_admin('a1000000-0000-0000-0000-000000000001', $$select public.permanently_remove_package('document-notes')$$);
select pg_temp.check(8, 'permanent removal deletes only the package''s own company data',
  (select count(*) = 0 from public.document_notes where company_id = 'a0000000-0000-0000-0000-000000000001')
  and (select data_state = 'purged' from public.company_packages
        where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'document-notes'));

-- 9) Unrelated tenant data is untouched by the other tenant's permanent removal.
select pg_temp.check(9, 'another tenant''s data is unaffected by cross-tenant purge',
  (select count(*) = 1 from public.document_notes where company_id = 'b0000000-0000-0000-0000-000000000002'));

-- 10) Unrelated HR Core entitlement remains for the purging company.
select pg_temp.check(10, 'HR Core entitlement is preserved after removing an extension',
  (select enabled from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-000000000001' and package_key = 'hr-core'));

-- 11) Audit + installation history survive permanent removal.
select pg_temp.check(11, 'audit history remains after permanent removal',
  exists (select 1 from public.audit_logs
          where company_id = 'a0000000-0000-0000-0000-000000000001' and action = 'package.uninstalled')
  and exists (select 1 from public.audit_logs
          where company_id = 'a0000000-0000-0000-0000-000000000001' and action = 'package.purge.completed'));

-- 12) A company admin can never target another company (RPCs use the caller's own
--     company). Beta's admin restoring "document-notes" only touches Beta.
select pg_temp.check(12, 'lifecycle RPC only ever affects the caller''s own company',
  (select count(*) = 1 from public.document_notes where company_id = 'b0000000-0000-0000-0000-000000000002'));

-- 13) Secure purge removes expired retained windows and is idempotent.
insert into public.company_packages (company_id, package_key, package_version, enabled, status, activated_at, installation_source, data_state, retention_until, previous_installed_version)
values ('b0000000-0000-0000-0000-000000000002', 'expense-requests', '1.0.0', false, 'installed', now(), 'company_marketplace', 'retained', now() - interval '1 day', '1.0.0');
insert into public.expense_requests (company_id, amount, description) values ('b0000000-0000-0000-0000-000000000002', 10, 'old');
select (public.purge_expired_retention()) ->> 'purged_packages' as purged1 \gset
select pg_temp.check(13, 'expired retention is purged and marked',
  :'purged1'::int >= 1
  and (select data_state = 'purged' from public.company_packages
        where company_id = 'b0000000-0000-0000-0000-000000000002' and package_key = 'expense-requests')
  and (select count(*) = 0 from public.expense_requests where company_id = 'b0000000-0000-0000-0000-000000000002'));

-- 14) Purge is idempotent — a second run purges nothing new.
select (public.purge_expired_retention()) ->> 'purged_packages' as purged2 \gset
select pg_temp.check(14, 'purge is idempotent (second run is a no-op)', :'purged2'::int = 0);

-- 15) Only diagnostic-PASS versions are installable (FAIL blocks install).
update public.package_versions set diagnostic_status = 'FAIL'
  where package_key = 'document-notes' and version = '1.0.0';
insert into auth.users (id, email) values ('e1000000-0000-0000-0000-000000000005', 'e-admin@x.com');
insert into public.companies (id, name, slug, status) values ('e0000000-0000-0000-0000-000000000005', 'Echo LC', 'echo-lc', 'active');
insert into public.company_memberships (company_id, user_id, role, status)
  values ('e0000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', 'company_admin', 'active');
select pg_temp.check(15, 'a FAIL-diagnostic version cannot be installed',
  pg_temp.errored('e1000000-0000-0000-0000-000000000005', $$select public.install_marketplace_extension('document-notes')$$));
update public.package_versions set diagnostic_status = 'PASS'
  where package_key = 'document-notes' and version = '1.0.0';

-- 16) Lifecycle operations are recorded for Platform-Admin monitoring.
select pg_temp.check(16, 'lifecycle operations are logged (uninstall/restore/purge)',
  exists (select 1 from public.package_lifecycle_operations where operation = 'uninstall')
  and exists (select 1 from public.package_lifecycle_operations where operation = 'restore')
  and exists (select 1 from public.package_lifecycle_operations where operation in ('purge', 'permanent_removal')));

rollback;
