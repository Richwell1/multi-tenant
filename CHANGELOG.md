# Changelog

## Unreleased — Platform Admin UI polish, phase 1 (branch `feat/platform-admin-ui-polish`)

First phase of the Admin UI polish, focused on the highest-leverage, low-risk
items. No business logic, RLS, or migrations changed.

- **Human-readable event labels:** a centralized mapper (`src/lib/audit-labels.ts`)
  turns raw action codes into labels (`marketplace.installed` → "Marketplace
  extension installed", `diagnostic.created` → "Diagnostic report created"), with
  a safe prettified fallback for unknown codes. Applied to the Dashboard Recent
  Activity list and the Audit Logs table — no raw codes are shown.
- **Page-header icons:** the shared `PageHeader` gained an optional portal-tinted
  `icon`; every top-level Admin page (Dashboard, Companies, Requests, Packages,
  Installations, Adoption, Usage, Health, Audit, Diagnostics) now leads with its
  icon for clearer hierarchy.
- Verified the branded loading architecture already in place (`TableSkeleton` via
  `TableBoundary`) and category-label clarity from the previous branch.
- **Motion:** kept restrained and dependency-free — reduced-motion-aware CSS
  (`motion-safe:` variants) rather than adding Framer Motion (~50 KB); revisit if
  richer motion is required. Bundle impact this phase: +~2.4 KB (icons only).
- Tests: `audit-labels.test.ts` (label mapping + no raw-code leakage). 317 tests.

_Remaining phases (sidebar grouping, top-bar profile menu, dashboard/metric and
per-page redesigns, login/logout feedback, dialogs, responsive/accessibility
sweep) are scoped in `docs/UI_UX_PROGRESS.md`._

## Unreleased — Company update notifications (branch `feat/company-update-notifications`)

- **Available Updates** now shows the updates actually assigned/released to the
  company: pending System Package, Private Extension, and Private Standalone
  installs. Uninstalled marketplace packages stay in the Marketplace; auto-pushed
  marketplace updates apply immediately (they don't linger as pending). Company
  is resolved server-side from the authenticated membership.
- New RPCs: `company_available_updates()` (tenant-scoped pending updates) and
  `install_company_update(id)` (an active `company_admin` installs one of its own
  updates — base/version gated, respects the installation state machine, blocks
  installing another company's update by id). Migration `20260731010000`.
- Page rewritten from a single hardcoded wizard to per-update cards with human
  category badges, installed/available versions, base package, release notes, and
  **per-card** install state (only the update being installed shows "Installing…").
  Empty state: "Your packages are up to date".
- **Sidebar badge** on Available Updates: count from one shared query
  (`useAvailableUpdateCount`), hidden at 0, `9+` above nine, with a subtle
  reduced-motion-aware pulse (`motion-safe:animate-pulse`). Clears on logout; the
  count is tenant-isolated (keyed by company).
- Tests: `company_updates_rls.sql` (10 scenarios) + AppShell badge, UpdatesPage
  (per-card pending), and logout-cache tests. 312 app tests, 17 SQL suites.

## Unreleased — Package category clarity (branch `refactor/package-categories`)

- Stop showing raw enum values (`standard_update`, `private_extension`,
  `private_customization`) in the UI. A centralized presentation mapper
  (`src/lib/packages/category.ts`) maps the persisted `packages.category` to four
  human labels: **System Package**, **Marketplace Extension**, **Private
  Extension**, **Private Standalone Package**, plus derived **visibility**
  (Platform managed / Marketplace / Private) and an "installed by" description.
- Admin **Packages** table columns are now Package · Category · Visibility ·
  Base Package · Status with distinct badges, an explanation line, and category
  filters (All / System / Marketplace / Private Extension / Private Standalone).
  Search spans name, key, category label, and base-package name. Package details
  show category, visibility, base package, installer, and description.
- `Package` domain model now carries `category` + `basePackageKey` (from the
  existing `packages.category` / `base_package_key` columns — no migration; the
  data was already correct). Mock derives category from the legacy type.
- Tests: `category.test.ts` (mapper/visibility/installer/compat) + a
  `PackagesList` component test (labels shown, raw enums hidden, base package,
  filter). 305 app tests.

## Unreleased — Marketplace fixes (branch `fix/marketplace-entitlement-and-ui`)

- **Fix (authorization):** installing a marketplace extension enabled the
  entitlement, but creating records (e.g. Document Notes) failed on hosted with
  "not authorized". Root cause: the new feature tables (`document_notes`,
  `expense_requests`, `visitor_register`) were missing the `authenticated` table
  grant — privileges are evaluated *before* RLS, and the install worked only
  because it runs through a SECURITY DEFINER RPC. Locally, default privileges
  auto-grant, which masked the gap. Added explicit grants (migration
  `20260730010000`); RLS remains the authorization boundary.
- **Fix (UI state):** the marketplace install mutation exposed one global
  `isPending`, so every card showed "Installing…". Pending state is now
  package-specific (keyed on `install.variables`); only the clicked card shows
  it and is disabled.
- **UX:** marketplace subtitle now "Optional standalone features your company can
  install"; cards show description, latest/installed version, and an Open action
  once installed. Feature-page create errors show inline only (removed the
  duplicate toast).
- Tests: `marketplace_notes_authz_rls.sql` (9 INSERT-authorization scenarios incl.
  the table-grant invariant) + a `MarketplacePage` component test (per-card
  pending). 275 app tests, 16 SQL suites.

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
