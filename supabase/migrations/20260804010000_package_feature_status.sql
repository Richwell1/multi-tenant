-- ===========================================================================
-- Honest feature-readiness on the package catalog.
--
-- A package version's `diagnostic_status` (PASS/WARN/FAIL) attests CATALOG +
-- LIFECYCLE readiness — it must NOT be read as "the business feature is built".
-- This adds an explicit implementation-readiness axis so a catalog-only package
-- (metadata + lifecycle only, no feature vertical yet) can never appear fully
-- production-ready. No diagnostics are faked; this is a separate, truthful field.
--
--   implemented  → a real feature vertical exists (page/table/repo/RLS/workflow)
--   catalog_only → discovery/review/lifecycle only; feature build is PENDING
-- ===========================================================================

alter table public.packages
  add column if not exists feature_status text not null default 'implemented';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'packages_feature_status_ck') then
    alter table public.packages
      add constraint packages_feature_status_ck
      check (feature_status in ('implemented', 'catalog_only'));
  end if;
end $$;

-- The eight catalog additions ship metadata + lifecycle only for now.
update public.packages
set feature_status = 'catalog_only'
where key in (
  'company-announcements', 'asset-register', 'pulse-surveys',
  'audit-exporter', 'bulk-importer', 'org-chart',
  'custom-onboarding-checklist', 'custom-approval-matrix'
);
