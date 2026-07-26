-- Multi-Tenants HR — private extensions (Platform-Admin-only, hidden, one company)
--
-- Two minimal private extensions of HR Core. They render inside existing HR Core
-- surfaces (Employees / Departments) for the assigned company only — gated by the
-- company_packages entitlement. Hidden from the marketplace (category =
-- private_extension). The Employee Approval card requires HR Core >= 1.1.0
-- (Employees), enforced by create_package_release via min_base_version. No
-- company identifiers appear anywhere — the target comes from the release.

insert into public.packages (key, name, type, is_active, category, base_package_key, min_base_version) values
  ('custom-employee-approval', 'Custom Employee Approval Card', 'private_extension', true, 'private_extension', 'hr-core', '1.1.0'),
  ('custom-department-code',   'Custom Department Code Field',  'private_extension', true, 'private_extension', 'hr-core', null)
on conflict (key) do nothing;

insert into public.package_versions (package_key, version, notes, released_at, diagnostic_status) values
  ('custom-employee-approval', '1.0.0', 'Employee Approval card for the Employees area.', null, 'PASS'),
  ('custom-department-code',   '1.0.0', 'Optional Department Code field.', null, 'PASS')
on conflict (package_key, version) do nothing;

-- The Department Code becomes an OPTIONAL field provided by the private
-- extension: baseline HR Core departments no longer require it, and only the
-- company with the extension surfaces it in the UI. Existing codes are kept;
-- the same-company uniqueness constraint still applies to non-null codes.
alter table public.departments alter column code drop not null;
