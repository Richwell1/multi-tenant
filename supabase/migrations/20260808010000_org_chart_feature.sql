-- ===========================================================================
-- Org Chart Viewer — first System Tool feature vertical.
--
-- Unlike the marketplace extensions, this optional System Tool owns NO
-- per-company data: it is a read-only visualization over existing HR Core data
-- (departments / positions / employees), which already have their own RLS.
-- Promotion therefore only flips feature readiness — no new table, no
-- feature_table (nothing to retain/purge), no new grants. It stays an OPTIONAL
-- standard package (is_mandatory unchanged = false) and is platform-managed
-- (not marketplace-installable).
-- ===========================================================================

update public.packages
set feature_status = 'implemented'
where key = 'org-chart';
