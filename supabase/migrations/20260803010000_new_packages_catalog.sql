-- ===========================================================================
-- Catalog: three Marketplace Extensions, three System Tools, and two Private
-- Customizations. Each ships a released, diagnostic-PASS 1.0.0 with a structured
-- impact_manifest so it flows through the install/review + lifecycle system.
--
-- These are catalog-level additions (metadata + lifecycle participation): they
-- are browsable/installable/assignable and honor disable/uninstall/retention.
-- System Tools are OPTIONAL standard packages (is_mandatory stays false).
-- Private Customizations extend HR Core for their assigned company only.
-- No feature_table is set yet (no per-company row data → nothing to purge).
-- ===========================================================================

-- Helper to keep the seed compact and consistent.
create or replace function pg_temp.seed_pkg(
  p_key text, p_name text, p_type public.package_type, p_category public.package_category,
  p_description text, p_base text, p_manifest jsonb
) returns void language plpgsql as $$
begin
  insert into public.packages (key, name, type, description, is_active, base_package_key, category, min_base_version)
  values (p_key, p_name, p_type, p_description, true, p_base, p_category, case when p_base is not null then '1.0.0' end)
  on conflict (key) do nothing;

  insert into public.package_versions (package_key, version, notes, released_at, diagnostic_status, impact_manifest)
  values (p_key, '1.0.0', 'Initial release.', now(), 'PASS', p_manifest)
  on conflict (package_key, version) do nothing;
end;
$$;

-- --- Marketplace Extensions (company self-installable) ------------------------
select pg_temp.seed_pkg('company-announcements', 'Company Announcements', 'shared_extension', 'marketplace_extension',
  'Broadcast company-wide announcements to your workspace.', null,
  jsonb_build_object(
    'version','1.0.0',
    'frontend', jsonb_build_object('navigationItemsAdded', jsonb_build_array('Announcements')),
    'backend', jsonb_build_object('policiesChanged', jsonb_build_array('company-scoped RLS')),
    'data', jsonb_build_object('notes', jsonb_build_array('Company-owned announcement records')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', true, 'reversible', true),
    'rollback', jsonb_build_object('supported', false),
    'retention', jsonb_build_object('policy','retain_then_purge','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

select pg_temp.seed_pkg('asset-register', 'Asset Register', 'shared_extension', 'marketplace_extension',
  'Track company assets and who they are assigned to.', null,
  jsonb_build_object('version','1.0.0','frontend', jsonb_build_object('navigationItemsAdded', jsonb_build_array('Assets')),
    'backend','{}'::jsonb,'data', jsonb_build_object('notes', jsonb_build_array('Company-owned asset records')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', true,'reversible', true),
    'rollback', jsonb_build_object('supported', false),
    'retention', jsonb_build_object('policy','retain_then_purge','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

select pg_temp.seed_pkg('pulse-surveys', 'Pulse Surveys', 'shared_extension', 'marketplace_extension',
  'Run short, recurring employee pulse surveys.', null,
  jsonb_build_object('version','1.0.0','frontend', jsonb_build_object('navigationItemsAdded', jsonb_build_array('Pulse Surveys')),
    'backend','{}'::jsonb,'data', jsonb_build_object('notes', jsonb_build_array('Company-owned survey records')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', true,'reversible', true),
    'rollback', jsonb_build_object('supported', false),
    'retention', jsonb_build_object('policy','retain_then_purge','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

-- --- System Tools (optional standard packages; platform-managed) --------------
select pg_temp.seed_pkg('audit-exporter', 'Audit Log Exporter', 'standard_update', 'standard_package',
  'Export company audit logs for compliance review.', null,
  jsonb_build_object('version','1.0.0','frontend','{}'::jsonb,'backend','{}'::jsonb,
    'data', jsonb_build_object('notes', jsonb_build_array('Reads existing audit records; creates none')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', false,'reversible', true),
    'rollback', jsonb_build_object('supported', true,'eligibleTargetVersions', jsonb_build_array()),
    'retention', jsonb_build_object('policy','preserve','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

select pg_temp.seed_pkg('bulk-importer', 'Bulk Data Importer', 'standard_update', 'standard_package',
  'Import departments, positions, and employees in bulk.', null,
  jsonb_build_object('version','1.0.0','frontend','{}'::jsonb,'backend','{}'::jsonb,
    'data', jsonb_build_object('notes', jsonb_build_array('Writes into existing HR Core tables')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', false,'reversible', true),
    'rollback', jsonb_build_object('supported', true),
    'retention', jsonb_build_object('policy','preserve','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

select pg_temp.seed_pkg('org-chart', 'Org Chart Viewer', 'standard_update', 'standard_package',
  'Visualize your organization structure from HR Core data.', null,
  jsonb_build_object('version','1.0.0','frontend', jsonb_build_object('navigationItemsAdded', jsonb_build_array('Org Chart')),
    'backend','{}'::jsonb,'data', jsonb_build_object('notes', jsonb_build_array('Read-only over departments/positions/employees')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0'),
    'migrations', jsonb_build_object('required', false,'reversible', true),
    'rollback', jsonb_build_object('supported', true),
    'retention', jsonb_build_object('policy','preserve','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

-- --- Private Customizations (private extensions of HR Core) -------------------
select pg_temp.seed_pkg('custom-onboarding-checklist', 'Custom Onboarding Checklist', 'private_extension', 'private_extension',
  'Adds a tailored onboarding checklist inside HR Core.', 'hr-core',
  jsonb_build_object('version','1.0.0','frontend', jsonb_build_object('componentsChanged', jsonb_build_array('Employee onboarding checklist card')),
    'backend','{}'::jsonb,'data', jsonb_build_object('notes', jsonb_build_array('Checklist state stored per company')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0','basePackageKey','hr-core','minimumBasePackageVersion','1.0.0'),
    'migrations', jsonb_build_object('required', true,'reversible', true),
    'rollback', jsonb_build_object('supported', false),
    'retention', jsonb_build_object('policy','retain_then_purge','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));

select pg_temp.seed_pkg('custom-approval-matrix', 'Custom Approval Matrix', 'private_extension', 'private_extension',
  'Adds a company-specific multi-step approval matrix to HR Core.', 'hr-core',
  jsonb_build_object('version','1.0.0','frontend', jsonb_build_object('componentsChanged', jsonb_build_array('Approval matrix settings')),
    'backend','{}'::jsonb,'data', jsonb_build_object('notes', jsonb_build_array('Approval rules stored per company')),
    'dependencies', jsonb_build_object('minimumPlatformVersion','v0.1.0','basePackageKey','hr-core','minimumBasePackageVersion','1.0.0'),
    'migrations', jsonb_build_object('required', true,'reversible', true),
    'rollback', jsonb_build_object('supported', false),
    'retention', jsonb_build_object('policy','retain_then_purge','retentionDays',30),
    'diagnostics', jsonb_build_object('status','PASS')));
