# Changelog

## Unreleased — Pulse Surveys feature vertical (branch `feat/pulse-surveys-vertical`)

Third full feature vertical — promotes Pulse Surveys from catalog_only to
**implemented** (all three new marketplace extensions are now real features).
- Migration `20260807010000`: `pulse_surveys` table (question/description/status)
  with entitlement-gated RLS (select/insert/update/delete via
  `can_use_company_package`), authenticated Data API grants (guardrail-checked),
  and `feature_status='implemented'` + `feature_table='pulse_surveys'`.
- Vertical: `src/data/pulse-surveys` (repo + mock + Supabase), zod service,
  `usePulseSurveys`/`useCreatePulseSurvey`, `PulseSurveysPage` (PackageGuard),
  route `/:companySlug/extensions/pulse-surveys`, nav, manifest, PACKAGE_CODES +
  PackageKey.
- Tests: mock/service units, page UI, SQL `pulse_surveys_authz_rls.sql` (8 checks).
  405 tests, 24/24 SQL suites.

## Unreleased — Asset Register feature vertical (branch `feat/asset-register-vertical`)

Second full feature vertical — promotes Asset Register from catalog_only to
**implemented**.
- Migration `20260806010000`: `assets` table (name/tag/assignee/status) with
  entitlement-gated RLS (select/insert/update/delete via `can_use_company_package`),
  authenticated Data API grants (guardrail-checked), and
  `feature_status='implemented'` + `feature_table='assets'` (retention/purge cover it).
- Vertical: `src/data/assets` (repo + mock + Supabase), zod service,
  `useAssets`/`useCreateAsset`, `AssetRegisterPage` (PackageGuard, table + status
  badges), route `/:companySlug/extensions/assets`, nav, manifest, PACKAGE_CODES +
  PackageKey.
- Tests: mock/service units, page UI, and SQL `assets_authz_rls.sql` (8 checks).
  399 tests, 23/23 SQL suites.

## Unreleased — Company Announcements feature vertical (branch `feat/company-announcements-vertical`)

First full feature vertical for a catalog package — promotes Company Announcements
from catalog_only to **implemented**.
- Migration `20260805010000`: `announcements` table with entitlement-gated RLS
  (select/insert/update/delete via `can_use_company_package`), authenticated Data
  API grants (guardrail-checked), and `feature_status='implemented'` +
  `feature_table='announcements'` (retention/purge now operate on its data).
- Vertical: `src/data/announcements` (repo + mock + Supabase), service (zod),
  `useAnnouncements`/`useCreateAnnouncement`, `AnnouncementsPage` (PackageGuard),
  route `/:companySlug/extensions/announcements`, nav item, manifest entry,
  PACKAGE_CODES + PackageKey.
- Tests: mock/service units, page UI, and SQL `announcements_authz_rls.sql`
  (8 checks incl. grant, tenant isolation, retention-hide, and purge). 393 tests,
  22/22 SQL suites.

## Unreleased — Feature-readiness honesty (branch `fix/hosted-lifecycle-readiness`)

- New `packages.feature_status` (`implemented` | `catalog_only`, migration
  `20260804010000`) — a truthful axis separate from diagnostics PASS so a
  catalog-only package can never appear fully production-ready. The eight new
  packages are `catalog_only`; real features are `implemented`.
- Marketplace + Installed Packages show a **"Feature implementation pending"**
  badge for catalog-only packages (and expose no feature page). No diagnostics are
  faked. 387 tests, 21/21 SQL suites.

## Unreleased — Package lifecycle Phases 3-5 (review dialogs, monitoring, new packages)

- **Impact manifests + review dialog:** `src/lib/packages/impact.ts` (structured
  `PackageImpactManifest`) and `PackageReviewDialog` shown before install/update/
  rollback — sectioned impact, a diagnostics gate (no confirm unless PASS), and an
  acknowledgement for breaking/irreversible change. Marketplace Install opens the
  review first.
- **Platform-Admin Lifecycle Monitoring** (`/admin/lifecycle`) over
  `package_lifecycle_operations` (metadata only; labels not raw enums) + the
  **purge-retention Edge Function** (service-role, idempotent, schedule-ready).
- **New packages:** three Marketplace Extensions (Company Announcements, Asset
  Register, Pulse Surveys), three optional System Tools (Audit Log Exporter, Bulk
  Data Importer, Org Chart Viewer), and two Private Customizations of HR Core
  (Custom Onboarding Checklist, Custom Approval Matrix) — migration
  `20260803010000`, each with a released diagnostic-PASS 1.0.0 + impact manifest.
- SQL suites `new_packages_catalog_rls.sql` (6 checks). 385 tests, 21/21 SQL suites.

## Unreleased — Package lifecycle TS layer + Installed-Packages actions (Phase 2)

- New `src/data/package-lifecycle` vertical: repository interface, a stateful
  mock (real disable→enable→uninstall→restore→permanently-remove transitions),
  and a Supabase adapter that drives the lifecycle RPCs + reads company_packages
  with retention state. Pages/components never call Supabase directly.
- Hooks: `useCompanyPackages` (lifecycle list) + `useDisablePackage` /
  `useEnablePackage` / `useUninstallPackage` / `useRestorePackage` /
  `usePermanentlyRemovePackage`, each invalidating only the current company's
  lifecycle + context queries and surfacing safe error messages.
- Installed Packages page rebuilt: lifecycle-status cards (Active / Disabled /
  Uninstalled / Removed) with retention-end dates and actions gated by category +
  role + state — Disable/Re-enable, Uninstall (→30-day retention confirm),
  Restore, and Permanently Remove (typed-confirmation dialog). Mandatory HR Core
  exposes no destructive actions; non-admins are read-only.
- Tests: action-gating logic, mock lifecycle transitions, and the panel UI
  (typed-confirmation gate). 380 tests.

## Unreleased — Package lifecycle & retention backbone (branch `feat/package-lifecycle-and-retention`)

Phase 1 of the package lifecycle: the authoritative, RLS-safe **database backbone**
for disable / uninstall / restore / permanent removal / secure purge, plus impact
manifests and lifecycle monitoring. (TS/UI layers, review dialogs, and the new
packages follow in later phases — see docs/PACKAGE_LIFECYCLE.md.)

- Migration `20260802010000_package_lifecycle_and_retention.sql`:
  `packages.is_mandatory` + `feature_table`, `package_versions.impact_manifest`,
  `company_packages` retention columns (`data_state`, `retention_until`, …),
  `package_lifecycle_operations` (one running op per company+package),
  `package_restore_points`, all RLS-gated.
- RPCs (self-authorizing company_admin): `disable_package`, `enable_package`,
  `uninstall_package` (→ 30-day retention, data preserved not deleted),
  `restore_package` (data returns, no duplication), `permanently_remove_package`
  (deletes only that package's company data). `purge_expired_retention`
  (service-role, idempotent, per-tenant failure isolation, counts-not-content).
- Mandatory HR Core cannot be uninstalled/removed by a company; lifecycle RPCs
  only ever act on the caller's own company; PASS-only install still enforced.
- SQL suite `package_lifecycle_rls.sql` (16 checks). 20/20 suites, 368 tests.

## Unreleased — Unique company slugs (branch `feat/unique-company-slugs`)

- **Company names may repeat; slugs are globally unique.** `companies.slug` keeps
  its `unique` constraint and gains lowercase / URL-safe-format / length(3..63) /
  non-reserved CHECK constraints (`companies_slug_*_ck`).
- **Backend-authoritative, collision-safe allocation** via new
  `public.register_company(user, name, requested_slug?, …)`: validates a chosen
  slug (never auto-suffixed → clean `duplicate_slug`) or derives one from the name
  and retries with a short **random** suffix (`acme-ltd-k7p2`) up to 5× inside the
  onboarding transaction — race-safe, non-sequential, no count leakage. The
  register-company Edge Function now calls it and returns the **persisted** slug;
  the client navigates with that slug, never re-derived.
- **Centralized reserved list** — `public.is_reserved_slug()` mirrored by
  `RESERVED_SLUGS` in `src/lib/slug.ts` and the Edge Function; `public.slugify()`
  and `public.is_slug_available()` (boolean-only UX check) added.
- **Registration UI** — the field is now a framed **Workspace URL**
  (`multi-tenant-hr.vercel.app/[slug]/dashboard`) with live available/taken/
  reserved/invalid feedback (reduced-motion-safe, no layout jump, `aria-describedby`
  + polite announce), lowercase-on-type, and a success screen showing the final
  backend URL. Auto-slug is sent only when the founder edits it.
- **Slug lookup** — RLS-gated `findCompanyBySlug` on the context repository
  (mock + Supabase); the Supabase context now reads `companies.slug` (not
  subdomain). Slug rename deferred (documented).
- **Additive migration** `20260801010000_unique_company_slugs.sql` with a
  defensive, deterministic backfill. 367 tests; SQL suite
  `unique_company_slugs_rls.sql` (19/19).

## Unreleased — Path-based tenant routing (branch `feat/path-based-tenant-routing`)

- Company workspace URLs are now prefixed with the tenant slug:
  `/:companySlug/dashboard`, `/:companySlug/departments`,
  `/:companySlug/extensions/marketplace`, … (e.g. `/rich/dashboard`). Platform
  Admin routes stay at `/admin/...` — never nested under a slug.
- Router: the workspace layout moved from a pathless group to `/$companySlug`;
  a bare `/:companySlug` redirects to `/:companySlug/dashboard`. Static routes
  (`/admin`, `/login`, …) keep priority over the dynamic segment.
- `CompanyGuard` validates the `/:companySlug` segment against the authenticated
  membership (mismatch → access-denied; unauthenticated → tenant login with the
  slug pre-filled). The slug is a routing identifier only — company UUID +
  membership + entitlement + RLS remain the security boundary.
- New `useCompanySlug` hook (reads the route param) builds slug-prefixed links in
  the workspace shell and pages; login lands the user on their own slugged
  dashboard. `isNavItemActive` recognizes the slugged dashboard as an exact
  destination. The existing Vercel SPA rewrite already serves every path.
- 351 tests (router inventory asserts slug-scoping + no admin-under-slug; guard
  tests cover slug match/mismatch/suspended/inactive and the bare-slug redirect).

## Unreleased — Provisioning guardrails + registration UX (branch `feat/package-security-guardrails-and-registration-ux`)

**Provisioning guardrail (prevents the confirmed 42501 class):**
- New `supabase/tests/feature_table_grants_guardrail.sql` — a *dynamic* drift
  detector. It reads `pg_policies` at run time and fails if any RLS-policied
  `public` table lacks the `authenticated` table privilege its policy commands
  imply (SELECT/INSERT/UPDATE/DELETE; ALL ⇒ all four). Because Postgres evaluates
  table privileges before RLS, that missing grant is exactly what made
  document_notes / expense_requests / visitor_register fail on hosted before
  migration `20260730010000`. Companion check: every policied table has RLS
  enabled. Includes a self-test proving the detector fires on drift. Every future
  feature table is covered automatically — nothing to maintain. 18/18 SQL suites.
- The already-correct `can_use_company_package(company_id, package_key)` helper is
  untouched.

**Company registration UX:**
- **Auto-slug** derived from the company name (editable; stops syncing once the
  founder edits it) via `deriveSlug`/`isValidSlug` (`src/lib/slug.ts`).
- **Live slug availability** through the registration repository
  (`checkSlugAvailability`) — authoritative in demo/mock, best-effort
  ("confirmed on submit") on hosted where uniqueness is enforced transactionally.
  Debounced, format-gated hook `useSlugAvailability`.
- **Show/hide password toggle** + advisory **strength meter** (`src/lib/password.ts`).
- **Success confirmation step** — a "You're all set" panel (workspace + starter
  HR Core) with an explicit "Continue to sign in"; no session is fabricated.
- **Clearer error surfacing** — duplicate slug/subdomain/email now land inline on
  the exact field (`RepositoryError.field`), not a generic banner or a "network"
  toast.
- 349 tests (adds slug/password/register/registration-adapter coverage). Layering
  preserved (page → hook → repository → adapter); no direct Supabase calls.

## Unreleased — Company workspace polish, phase 2 (branch `feat/workspace-polish-phase2`)

- **Departments / Positions:** page-header icons + descriptions, and actionable
  empty states — the "no records yet" panel now carries an **Add Department** /
  **Add Position** button that opens the create form (via a new optional
  `emptyAction` on `TableBoundary`).
- **Installed Packages:** summary metrics (installed-package count + features
  unlocked, both derived from context/manifest — never hardcoded) and richer
  cards (version badge in the header + per-package feature count).
- **Users & Roles:** page-header icon + summary metrics (total users / active /
  administrators, computed from the loaded list).
- **Company Settings:** page-header icon.
- 332 tests (adds `workspace-polish.test.tsx`). Motion stays dependency-free.

## Unreleased — Installed-package runtime access (branch `fix/installed-package-runtime-access`)

- **Investigation (not a guess):** the "Could not add the note" feature-write
  failure was the missing `authenticated` table grant on the marketplace/private
  feature tables — table privileges are checked *before* RLS, so INSERTs were
  denied with 42501. This was already fixed by migration `20260730010000`
  (grants on `document_notes` / `expense_requests` / `visitor_register`, deployed
  to hosted); the entitlement-gated RLS (`can_use_company_package`) and the
  insert payload (company UUID from the authenticated membership context) are
  correct. Verified end-to-end by `marketplace_notes_authz_rls.sql`.
- **Authoritative runtime-access helper:** `can_use_company_package(company, package, uid)`
  (active member ∧ active company ∧ enabled+active package) is the single helper
  used by every feature-table INSERT/SELECT policy — no redundant duplicate added.
- **Dev diagnostics:** `logSupabaseError` now also retains `details` and `hint`
  (dev-only, credential-free) so a grant/policy failure is fully identifiable in
  the console; user-facing messages remain safe. Test added. 329 tests.

## Unreleased — Company marketplace redesign (branch `feat/company-marketplace-redesign`)

- **Extensions Marketplace redesign**: a search box + category filter chips
  (All / Productivity / Finance / HR Tools / Operations, mapped per package),
  richer cards with a category badge and a feature list, and a "no matching
  extensions" state. Per-card install/open state and installed/version badges
  are preserved. Category/feature mapping is presentation-only (no business
  rules); motion stays dependency-free.
- Tests: marketplace category + search filtering. 328 tests.

## Unreleased — Company workspace UI polish, phase 1 (branch `feat/company-workspace-ui-polish`)

Mirrors the Admin polish for the company workspace (same green identity). Motion
stays dependency-free (`motion-safe:` CSS). No business/RLS changes.

- **Sidebar grouping** — the workspace sidebar is grouped into Workspace /
  Installed Features / Extensions / Administration via `NavItem.section`; empty
  groups don't render (version-gated items still appear only when entitled). The
  shared top-bar profile menu + update badge/pulse already apply here.
- **Dashboard** — a welcome header (company name, HR Core + platform version
  badges) replaces the sparse layout; metric cards now carry icons (Employees,
  Departments, Positions, Installed Packages, Available Updates) and an installed-
  packages summary list.
- Tests: WorkspaceDashboard (header, metrics, installed summary). 327 tests.

_Marketplace redesign, Installed Packages cards, per-page polish, and the
loading/state sweep continue in later phases (scoped in `docs/UI_UX_PROGRESS.md`)._

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

**Phase 2:**
- **Sidebar section grouping** — `NavItem.section` groups the Admin sidebar into
  Platform / Packages / Operations with section labels (hidden when collapsed).
- **Top-bar profile menu** — an accessible account dropdown (identity, role/
  context, app version, logout) replaces the plain email + logout link; closes on
  Escape / outside click with `aria-haspopup` / `aria-expanded`.
- **Dashboard metric icons** — `StatCard` gained an optional portal-tinted icon +
  tabular numerals; dashboard cards now carry icons.
- Tests: AppShell section + profile-menu, StatCard. 322 tests. Bundle +~2.2 KB.

**Phase 3 (per-page polish):**
- **Companies page** — avatar initials, a status filter (All / Active /
  Suspended), a total/active summary line, package count as a badge, tabular
  numerals, and search across name + subdomain.
- More consistent, actionable empty-state copy (Requests, Diagnostics).
- Tests: CompaniesList (avatars, summary, status filter). 324 tests.

**Phase 4 (Installations + Adoption):**
- **Installation Monitoring** — summary count cards (Installed / Pending /
  Installing / Failed) and a status icon per row (installing spins, respecting
  reduced-motion) alongside the status badge.
- **Marketplace Adoption** — summary cards (extensions, total installs, most
  installed) and a per-row adoption progress bar (`role="progressbar"`) showing
  distinct companies as a percentage of active companies.
- Tests: Adoption progress-bar percentage. 325 tests.

**Phase 5 (Operations pages):**
- **Usage Analytics** — summary cards (total actions, modules tracked) + tabular numerals.
- **System Health** — a status icon per signal card (healthy ✓ / degraded ⚠ / offline ✕).
- **Diagnostics** — a result icon per row and a "passed / total passed" count.
- Tests: Diagnostics checks-passed count. 326 tests.

**Phase 6 (auth feedback + dialogs):**
- **Login** shows a single "Signed in successfully" toast after the session and
  Platform-Admin/company context resolve (not before).
- **Logout** shows one "Signed out successfully" toast; the profile-menu action
  shows a pending "Signing out…" state and is disabled to prevent duplicate
  clicks. Rejection-cleanup logouts on the login page are `silent` (no toast), so
  no contradictory "signed out" appears while signing in.
- Confirmed `ConfirmDialog` already traps focus, closes on Escape, and returns
  focus to the trigger (covered by existing state tests).
- Tests: profile-menu logout pending state. 326 tests.

_Remaining (responsive/accessibility audit, design-token centralization, optional
Framer Motion) are scoped in `docs/UI_UX_PROGRESS.md`._

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
