-- ===========================================================================
-- Lifecycle monitoring: declare the package relationship.
--
-- `package_lifecycle_operations.package_key` (and the sibling column on
-- `package_restore_points`) carried a catalog key but never declared the
-- foreign key that every other package-referencing table declares
-- (`package_versions`, `company_packages`, `package_releases`, …).
--
-- PostgREST resolves embedded resources (`select=...,packages(name)`) purely
-- from declared foreign keys, so Platform Admin's Lifecycle Monitoring query
-- failed at schema-cache parse time — before privileges or RLS were ever
-- evaluated — with:
--
--   400 PGRST200 "Could not find a relationship between
--   'package_lifecycle_operations' and 'packages' in the schema cache"
--
-- Declaring the key both restores referential integrity and lets the existing
-- monitoring query embed the package name. No grant, policy, or RLS change is
-- required or made here: the SELECT policy and the `authenticated` grant from
-- 20260802010000 are correct and remain the authorization boundary.
--
-- ON DELETE RESTRICT matches the `company_packages` convention and protects the
-- monitoring log: a catalog package with lifecycle history cannot be deleted
-- out from under its own audit trail.
-- ===========================================================================

-- Fails loudly (rather than silently dropping rows) if any operation ever
-- referenced a key absent from the catalog. Verified 0 orphans locally and
-- structurally impossible via the SECURITY DEFINER RPCs, which only ever log a
-- key already present in `company_packages`.
alter table public.package_lifecycle_operations
  add constraint package_lifecycle_operations_package_key_fkey
  foreign key (package_key) references public.packages (key) on delete restrict;

alter table public.package_restore_points
  add constraint package_restore_points_package_key_fkey
  foreign key (package_key) references public.packages (key) on delete restrict;

-- Serve the referential-integrity check on catalog deletes. The existing
-- composite index leads with company_id, so it cannot answer a package_key-only
-- lookup.
create index if not exists package_lifecycle_operations_package_key_idx
  on public.package_lifecycle_operations (package_key);
create index if not exists package_restore_points_package_key_idx
  on public.package_restore_points (package_key);
