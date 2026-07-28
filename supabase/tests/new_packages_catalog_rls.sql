-- New package catalog: three Marketplace Extensions, three System Tools, and two
-- Private Customizations are seeded with released, diagnostic-PASS versions and a
-- structured impact manifest, and behave correctly under the marketplace + release
-- gates. 6 ok notices.

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

-- 1) Categories are correct: 3 marketplace, 3 standard, 2 private.
select pg_temp.check(1, 'three of each category are catalogued',
  (select count(*) = 3 from public.packages where category = 'marketplace_extension'
     and key in ('company-announcements','asset-register','pulse-surveys'))
  and (select count(*) = 3 from public.packages where category = 'standard_package'
     and key in ('audit-exporter','bulk-importer','org-chart'))
  and (select count(*) = 2 from public.packages where category = 'private_extension'
     and key in ('custom-onboarding-checklist','custom-approval-matrix')));

-- 2) Every new package has a released, diagnostic-PASS version with a manifest.
select pg_temp.check(2, 'each new package has a released PASS version + impact manifest',
  (select count(*) = 8 from public.package_versions
    where package_key in ('company-announcements','asset-register','pulse-surveys',
                          'audit-exporter','bulk-importer','org-chart',
                          'custom-onboarding-checklist','custom-approval-matrix')
      and released_at is not null and diagnostic_status = 'PASS'
      and impact_manifest ? 'diagnostics'));

-- 3) System Tools are OPTIONAL (never mandatory).
select pg_temp.check(3, 'system tools are not mandatory',
  not exists (select 1 from public.packages
              where key in ('audit-exporter','bulk-importer','org-chart') and is_mandatory));

-- 4) Private Customizations depend on HR Core.
select pg_temp.check(4, 'private customizations extend HR Core',
  (select count(*) = 2 from public.packages
    where key in ('custom-onboarding-checklist','custom-approval-matrix')
      and base_package_key = 'hr-core' and min_base_version = '1.0.0'));

-- 5) A company admin can self-install a new Marketplace Extension.
insert into auth.users (id, email) values ('a1000000-0000-0000-0000-0000000000a1', 'a@cat.test');
insert into public.companies (id, name, slug, status) values ('a0000000-0000-0000-0000-0000000000a1', 'Cat Co', 'cat-co', 'active');
insert into public.company_memberships (company_id, user_id, role, status)
  values ('a0000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000a1', 'company_admin', 'active');
select set_config('request.jwt.claims', json_build_object('sub','a1000000-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
set local role authenticated;
select public.install_marketplace_extension('company-announcements');
reset role;
select pg_temp.check(5, 'company admin can install a new marketplace extension',
  (select enabled from public.company_packages
    where company_id = 'a0000000-0000-0000-0000-0000000000a1' and package_key = 'company-announcements'));

-- 6) A Private Customization is NOT installable via the marketplace path.
select pg_temp.check(6, 'private customization cannot be self-installed from marketplace',
  pg_temp.errored('a1000000-0000-0000-0000-0000000000a1',
    $$select public.install_marketplace_extension('custom-approval-matrix')$$));

-- 7) Readiness is honest: catalog-only packages report catalog_only, while a
--    package with a real feature vertical (Document Notes, and now Company
--    Announcements) is implemented — diagnostics PASS never implies "built".
select pg_temp.check(7, 'catalog-only packages report catalog_only; real features are implemented',
  (select count(*) = 7 from public.packages where feature_status = 'catalog_only'
     and key in ('asset-register','pulse-surveys',
                 'audit-exporter','bulk-importer','org-chart',
                 'custom-onboarding-checklist','custom-approval-matrix'))
  and (select feature_status = 'implemented' from public.packages where key = 'document-notes')
  and (select feature_status = 'implemented' from public.packages where key = 'company-announcements'));

rollback;
