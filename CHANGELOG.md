# Changelog

## Unreleased — Marketplace + private packages (branch `feat/marketplace-and-private-packages`)

Adds company self-service and Platform-Admin private assignment. `APP_VERSION`
stays `v0.1.0`; package versions are independent.

- **Distribution model**: `packages.category` (standard_package / marketplace_extension /
  private_standalone / private_extension) + `company_packages.installation_source`
  (platform_push / company_marketplace / private_assignment / registration_default).
  `packages` discovery tightened so companies see only marketplace + entitled packages.
- **Marketplace extensions** (Document Notes, Expense Requests): company_admin
  self-install via `install_marketplace_extension` (gated: active company_admin,
  marketplace-only, latest released+PASS, deps, not-already-installed; private
  keys hard-blocked). Extensions Marketplace / Installed / feature pages; admin
  Marketplace Adoption page. Document Notes 1.1.0 update pushed to installers only
  (`publish_update_to_installers`).
- **Private extensions** (Custom Employee Approval Card, Custom Department Code
  Field): Admin-assigned to one company, hidden, base + base-version gated
  (Approval needs HR Core ≥ 1.1.0); render inside Employees/Departments for the
  assigned company only. `departments.code` is now an optional extension field.
- **Private standalone** (Custom Visitor Register): Admin-assigned to one company,
  hidden, no base.
- **Update matrix**: standard update → all active companies; marketplace install →
  installing company only; marketplace update → current adopters only; private
  extension/standalone update → the assigned company only. None changes `APP_VERSION`.
- Tests: `marketplace_foundation` (10), `marketplace_packages` (8),
  `private_extensions` (7), `private_standalone` (6) SQL suites + unit tests
  (install gate, feature gating, logout cache clear, no-hardcoded-company).

## Unreleased

Minimal package-version demo (branch `feat/minimal-package-version-demo`).
Proves package versioning end-to-end. Platform `APP_VERSION` stays `v0.1.0`.

- Version-gated features via a centralized package→feature manifest: HR Core
  1.0.0 exposes Departments; 1.1.0 adds Employees; Attendance 1.0.0 exposes
  Attendance. Nav, direct routes, and rendering all gate on the installed
  version (Employees needs HR Core ≥ 1.1.0; Attendance needs ≥ 1.0.0).
- Company context now carries installed package versions (`enabledPackages`);
  the Installed Packages page shows each package name, installed version, and
  available features from the manifest — separate from the platform version.
- Seeded HR Core 1.1.0 and Attendance Management 1.0.0 (diagnostic PASS,
  unreleased) so the Admin can publish them live; registration keeps assigning
  the latest released, PASS, highest-semver HR Core (never hardcoded).
- Added semver util, manifest, version-aware `PackageGuard`, and tests
  (semver, manifest gating, no-hardcoded-company, version guard) plus the
  `minimal_package_version_demo_rls.sql` suite.

## Demo package workflows (branch `feat/demo-package-workflows`)

Platform version remains `v0.1.0`; package versions change independently.

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
