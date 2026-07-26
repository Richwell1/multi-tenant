-- The Data API requires table privileges before RLS policies are evaluated.
-- Every application table is RLS-protected; these grants make the browser
-- client eligible to reach the tables while the existing policies remain the
-- authoritative authorization boundary.
grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.platform_admins,
  public.companies,
  public.company_memberships,
  public.packages,
  public.package_versions,
  public.company_packages,
  public.company_settings,
  public.departments,
  public.positions,
  public.employees,
  public.leave_requests,
  public.attendance_records,
  public.request_records,
  public.package_releases,
  public.package_release_targets,
  public.package_installations,
  public.diagnostic_reports,
  public.diagnostic_checks,
  public.audit_logs
to authenticated;
