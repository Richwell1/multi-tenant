# Changelog

## Unreleased

Demo package workflows (branch `feat/demo-package-workflows`). Platform version
remains `v0.1.0`; package versions change independently.

- Added the `private_extension` package type (one company, requires an enabled
  base package) alongside `standard_update` and the standalone
  `private_customization`; existing enum values are preserved (no renames).
- Added a `packages.base_package_key` dependency and a DB-enforced rule: a
  private extension can only be released to a company that already has its base
  package enabled.
- Made automatic installation transactional — publishing with "Install
  automatically" enables every active target's entitlement and marks it
  installed in one transaction; any failure rolls back the whole release.
- Registration now assigns the latest **released, diagnostic-PASS, highest
  semantic version** of HR Core (no hardcoded version); publishing a newer
  all-company HR Core release becomes the default for future registrations.
- Added the Create Package base-package field, a company-workspace platform
  version line, a 23-scenario SQL suite, and unit coverage.

## 0.1.0

Initial hosted-capable Multi-Tenants HR demonstration release.

- Added company registration, email/password authentication, and tenant guards.
- Added HR Core, optional Leave and Attendance packages, and package release
  targeting.
- Added Request Records, Diagnostics, Installation Monitoring, Usage Analytics,
  Audit Logs, and System Health.
- Added Supabase Auth, PostgreSQL RLS, authenticated SQL suites, and Vercel SPA
  deployment support.
- Added shared loading, empty, error, retry, confirmation, accessibility, and
  application-version UI foundations.
- Added Platform Admin package creation, package-version creation, atomic
  release planning, independent per-company installation processing, retry
  summaries, and release details.
