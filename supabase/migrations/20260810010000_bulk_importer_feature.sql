-- ===========================================================================
-- Bulk Data Importer — System Tool feature vertical.
--
-- An optional System Tool that WRITES into existing HR Core tables (departments
-- to start) through the normal repository/service path — so HR Core's own RLS
-- and validation govern every insert. It owns NO table of its own, so promotion
-- only flips feature readiness: no new table, no feature_table (nothing to
-- retain/purge), no new grants. It stays optional (is_mandatory unchanged) and
-- platform-managed (not marketplace-installable).
-- ===========================================================================

update public.packages
set feature_status = 'implemented'
where key = 'bulk-importer';
