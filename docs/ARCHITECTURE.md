# Architecture — Multi-Tenants HR

## Purpose and boundaries

Multi-Tenants HR is a lightweight multi-tenant HR ERP demonstration. It proves
company registration, email/password authentication, tenant isolation, role
boundaries, HR Core, optional packages, release targeting, diagnostics, and
basic platform operations. It is one shared web application backed by one
Supabase project; it is not a collection of company-specific deployments.

The product deliberately does not include MFA, OTP, password reset, invitation
onboarding, chat, payroll, recruitment, billing, microservices, Kubernetes, or
advanced incident management.

## Runtime stack

- React 18, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS
- Supabase Auth and PostgreSQL through the Supabase JavaScript client
- Supabase Edge Function for atomic company registration
- Vitest and React Testing Library for application tests
- Supabase CLI SQL suites for authenticated RLS and RPC scenarios, including a
  dynamic **privilege-drift guardrail** (`feature_table_grants_guardrail.sql`)
  that fails if any RLS-policied `public` table is missing the `authenticated`
  Data API grant its policies imply — Postgres checks table privileges before
  RLS, so a missing grant is a 42501 the browser hits before RLS ever runs
- Vercel for the SPA deployment; `vercel.json` rewrites application routes to
  `index.html`

The application supports two data sources. `VITE_DATA_SOURCE=mock` is the safe
default for the seeded demonstration and local UI work. `VITE_DATA_SOURCE=supabase`
selects the hosted/local Supabase adapters. The browser only receives the
publishable Supabase key; a service-role key is never a frontend variable.

## Layering

```text
Routes and page components
        |
Shared shells, guards, states, dialogs, notifications
        |
TanStack Query hooks and query-key factory
        |
Domain services (validation, transitions, entitlement rules)
        |
Repository interfaces
        |
Mock adapters                 Lazy Supabase adapters
        |                       |
Seeded in-memory data          Supabase Auth, Data API, RPCs
                                |
                         PostgreSQL + RLS
```

Pages should remain small. They select data, render states, and call services;
they should not embed tenant authorization or raw Supabase queries. Services
own business validation and state transitions. Repositories own persistence
and map transport errors into application errors. `repository.ts` is the
factory boundary and `LazySupabaseRepository` binds Supabase methods to the
aggregate interface only when the Supabase source is selected.

## Authentication and session lifecycle

Supabase Auth owns email/password identity. `SessionProvider` restores the
session once, subscribes to auth changes, and exposes the current user and a
logout action. The restore path always leaves the loading state, including when
the initial Auth request fails. Logout clears the local session and TanStack
Query cache even if remote sign-out cannot be confirmed, preventing stale tenant
data from surviving a failed network request.

```text
Auth restore
  -> SessionProvider
  -> platform-admin or company context query
  -> route guard
  -> shell and page queries
```

Platform authorization is checked against `platform_admins`, not a client
metadata flag. Company access is resolved from the authenticated user,
company slug/tenant query state, `company_memberships`, company status, and
package entitlements. A failed authorization/context query is shown as a
retryable error; it is not silently treated as an empty company.

## Tenant resolution and isolation

The shared login route is `/login`. A `tenant` query parameter can select a
company slug for the demonstration, while a session may also resolve the
company from membership. Tenant-owned operations use the real `companies.id`
UUID, never a slug or mock identifier. Slugs are for display and resolution;
UUIDs are the persistence key.

**Path-based tenant routing.** Company workspace URLs are prefixed with the
tenant slug: `/:companySlug/dashboard`, `/:companySlug/departments`,
`/:companySlug/extensions/marketplace`, and so on (e.g.
`https://multi-tenant-hr.vercel.app/rich/dashboard`). Platform Admin routes stay
at `/admin/...` and are never nested under a company slug. The slug is a routing
identifier only: `CompanyGuard` verifies the `/:companySlug` segment against the
authenticated membership (mismatch → access-denied), and `useCompanySlug` reads
it solely to build links. It never replaces the company UUID, membership,
entitlement checks, or RLS — the final security boundary remains authenticated
membership plus `company_id` and RLS. After sign-in the user lands on their own
slugged dashboard; a bare `/:companySlug` redirects to `/:companySlug/dashboard`.
The single Vercel SPA rewrite already serves every non-asset path.

**Globally unique slugs.** Company **names may repeat**; company **slugs are
globally unique**. `companies.slug` is `not null unique` and additionally
constrained to be lowercase, URL-safe (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), 3–63 chars,
and non-reserved (`companies_slug_lowercase_ck` / `_format_ck` / `_length_ck` /
`_not_reserved_ck`). The **backend is authoritative** for allocation:
`public.register_company(user, name, requested_slug?, …)` either validates a
chosen slug (never auto-suffixed — a conflict is a clean `duplicate_slug`) or
derives one from the name and, on collision, retries with a short **random**
suffix (e.g. `acme-ltd-k7p2`) up to 5 times inside the onboarding transaction —
race-safe, never a predictable `-2`/`-3` sequence, never leaking counts. The
persisted slug is returned and used verbatim for navigation; it is never
re-derived on the client. The reserved-word list lives once as
`public.is_reserved_slug()` mirrored by `RESERVED_SLUGS` in `src/lib/slug.ts`
(and the Edge Function). `public.is_slug_available()` powers pre-submit UX
(boolean only — no company rows). Slugs are immutable after registration; a
controlled rename flow (with redirects) is deferred. The company UUID remains the
tenant identity and, with membership + RLS, the security boundary — a slug is
never an authorization path (`findCompanyBySlug` is RLS-gated and returns nothing
for tenants you are not a member of).

Every tenant-owned table carries `company_id`. Repositories include the
company scope, and PostgreSQL RLS is the authoritative boundary. The browser
does not use a service-role key and frontend hiding is not security.

```text
authenticated request
  -> Supabase JWT auth.uid()
  -> membership/company/package helper functions
  -> RLS policy checks company_id and role/entitlement
  -> row or RPC result
```

The platform plane contains platform-admin-only records such as request
records, package authoring, enriched audit views, usage aggregation, health,
and diagnostics. The tenant plane contains company memberships, HR Core,
optional package data, assignments, installations, and tenant events. Any
new table must declare which plane owns it, include `company_id` when it is
tenant-owned, enable RLS, and have tests for same-company and cross-company
access.

RLS and Data API exposure are separate concerns. RLS controls rows after a
table is exposed; grants/API exposure control whether a role can access the
table at all. This project does not change either casually. A 403 must first
be reproduced and identified as a grant/exposure problem or an RLS policy
problem before a migration is added.

## Roles and route guards

The supported roles are:

- `platform_super_admin`: platform control-plane access
- `company_admin`: company administration and eligible package actions
- `company_user`: company read access within the permitted scope

`PlatformGuard`, `CompanyGuard`, and `PackageGuard` protect routes. Guards
distinguish pending, denied, suspended, and query-error states. A suspended
company is routed to the suspended state; a user without the required role or
entitlement is routed to access denied; a transient context failure offers
retry. No `hr_manager` role is implied by the UI or repository layer.

## Package and release model

HR Core is assigned automatically to each registered company and contains
Employees, Departments, and Positions. Leave Management and Attendance
Management are optional packages. `enabledPackageCodes` from the resolved
company context is the shared entitlement input for route and action guards.

Package classification and release targeting are distinct:

- Standard updates may target all active companies.
- Private customizations may target one selected company.
- Selected-company targeting is represented explicitly by release targets.

Publishing is authorized and validated by the database RPC. The release gate
uses diagnostic results, then creates a release plan atomically. Planning
creates release targets and pending installations but does not install every
company in one transaction. `process_package_installation` processes exactly
one target, updates its entitlement only after success, and records safe failure
metadata. Installation recovery is a state machine: retry processes only the
selected failed row and rollback disables the corresponding assignment. The UI
mirrors valid transitions, but the database remains the authority.

Package versions (`package_versions`) describe a package release. The platform
application version is separate: `package.json` is the source of truth and
`src/lib/app-version.ts` exposes the `v0.1.0` display value. A package release
must not be mistaken for a platform deployment.

### Classification versus targeting

Classification answers “what kind of change is this?” The supported package
classifications are standard update, private extension, private customization,
shared extension, configuration update, bug fix, and security update. Targeting
answers “which companies receive it?” and is independently represented as all
companies, selected companies, or one company. A private customization or
private extension can target only one company; a shared extension can target
selected or all companies. The database RPC validates the combination, so the UI
is not the final authority.

A **private extension** additionally depends on a base package
(`packages.base_package_key`): it can only be released to a company that already
has that base package enabled. The dependency is a simple presence check (no
semantic min/max compatibility ranges) enforced in `create_package_release`.

When "Install automatically" is checked, `create_package_release` is
**transactional**: it enables each active target's entitlement and marks the
installation installed within one transaction, so a release either fully
succeeds or rolls back with a clear error. Setting `automatic_install=false`
keeps the two-stage flow (pending installations processed independently, with
per-company retry).

### Release records

The release model keeps these concepts distinct:

1. Package definition — the stable package key and catalog metadata.
2. Package version — version, notes, diagnostic status, and release metadata.
3. Release — the publish operation for a package version.
4. Release targets — all, selected, or one company recipients.
5. Assignments — the company's enabled entitlement.
6. Installations — the operational state of applying the release.
7. Diagnostics — impact and required-check evidence for the release gate.
8. Audit and usage — platform activity and derived operational analytics.

Package creation is metadata management, not feature generation. The package
implementation remains in the shared codebase and deployment. Package-aware
routes, navigation, services, repositories, tables, and RLS provide the
feature; package assignments only control access for a tenant.

**Version-gated features.** Access is gated on the company's *installed version*,
not only the entitlement. The resolved company context carries
`enabledPackages` (code + installed version), and a centralized manifest
(`src/lib/packages/manifest.ts`) maps each package version to its features and
the minimum version that unlocks each (e.g. Employees requires HR Core ≥ 1.1.0).
Navigation, the route-level `PackageGuard` (with an optional `minVersion`), and
page rendering all read that one source; RLS remains the authoritative boundary.
Package versions are independent of the platform `APP_VERSION`.

**Distribution models.** `packages.category` separates *how a package is
distributed* from its change-type: `standard_package` (platform-pushed to all),
`marketplace_extension` (company self-installed), `private_standalone` and
`private_extension` (Platform-Admin assigned to one company, hidden). Company
package discovery is RLS-restricted to marketplace + entitled packages, so a
company can neither see nor install a private package by key. Company self-install
runs through the SECURITY DEFINER `install_marketplace_extension` (active
company_admin + active company + marketplace category + released/PASS version +
dependencies + not-already-installed); private assignment goes through
`create_package_release` (one company, base + base-version gate). Every
entitlement records an `installation_source`, and marketplace updates
(`publish_update_to_installers`) reach only current adopters. Logout clears the
React Query cache, so entitlement and marketplace data never leak across sessions.

Raw category enums are never rendered: `src/lib/packages/category.ts` is the one
presentation mapper from `packages.category` to human labels (System Package /
Marketplace Extension / Private Extension / Private Standalone Package), with
visibility derived from category. `Package` domain objects carry `category` and
`basePackageKey`; a `toPackageCategory` compatibility helper prefers the explicit
persisted category and never infers a category from the package name.

**Company Available Updates** are derived, tenant-scoped, and company-installable.
`company_available_updates()` (SECURITY DEFINER, membership-derived) returns the
caller company's pending/failed release installations that are newer than what's
installed — never another company's. `install_company_update(id)` lets an active
`company_admin` install one of its own updates (base + base-version gated,
respecting the installation state machine); it blocks installing another
company's update by guessing an id. The page and the sidebar count badge read one
shared query key, so the count and list never diverge and both clear on logout.

The operational lifecycle is:

```text
Request → classification → package definition → shared-code implementation
→ version creation → diagnostics → release plan → target installations
→ monitoring → retry/rollback/deprecation
```

An installation state transition is enforced in the database and mirrored in
the service/UI. Recovery is explicit: retry can restore a failed installation;
rollback disables its assignment. A package release does not increment the
global platform version unless the shared application is also deployed.

## Domain modules

```text
auth / registration
companies / memberships
departments / positions / employees
packages / releases / assignments / installations
leave / attendance
request records
diagnostics
usage analytics / audit logs / system health
```

The registration Edge Function performs the server-side atomic onboarding
workflow: Auth user, company, membership, and automatic HR Core assignment.
The browser calls the function; it does not receive or store the service-role
credential. The `onboard_company` RPC resolves the mandatory HR Core version
dynamically — the globally active package's latest **released, diagnostic-PASS,
highest semantic version** — rather than a hardcoded version, so publishing a
newer all-company HR Core release automatically becomes the default for future
registrations. The assignment is idempotent (`unique(company_id, package_key)`),
assigns only HR Core, and fails safely (`hr_core_unavailable`) if no eligible
version exists rather than creating a company without its mandatory entitlement.

## UI state and interaction rules

Shared `TableBoundary`, `StateShell`, `ErrorState`, `EmptyState`, and
`ConfirmDialog` components provide consistent states. List pages treat zero
rows as valid data: empty companies, installations, audit events, diagnostics,
and usage values render empty/zero states rather than exceptions. Optional
dashboard widgets are isolated where practical so one optional failure does
not blank the entire dashboard. Critical session and authorization failures
remain page-level failures.

Mutations use the central notification utility and invalidate the relevant
tenant-scoped query keys. Destructive actions use a confirmation dialog. Dialog
titles/descriptions have unique IDs, Escape/backdrop cancellation is available,
focus is trapped while open, and focus returns to the trigger. Error and
suspended states use alert semantics; ordinary loading/status states use
status semantics.

All shells expose active navigation, mobile navigation, keyboard-visible focus,
responsive layouts, and the shared application version. Full browser visual
smoke testing at 320, 375, 768, 1024, and 1440 pixels remains a deployment
check, not a claim of automated coverage.

## Testing and CI

Application tests cover repository/service behavior, route guards, package
targeting, transitions, tenant scoping, notifications/states, and the lazy
repository boundary. CI runs typecheck, lint, 227 application tests, and a
production build. The Supabase job starts a local project, resets it, and runs
eight SQL/RLS suites containing 94 authenticated scenarios before cleanup.

Any schema or RLS change must add/update a migration and its security tests.
The local reset is safe for local development; `supabase db reset --linked` is
not an accepted workflow because it targets the hosted project.

## Engineering principles

1. Apply single responsibility and separation of concerns across routes,
   components, hooks, services, repositories, and adapters.
2. Prefer dependency inversion: pages depend on hooks/services and interfaces,
   not Supabase clients or concrete adapters.
3. Use DRY, KISS, YAGNI, and composition over duplicated components or rules.
4. Prefer explicit TypeScript types, centralized validation, and centralized
   error mapping.
5. Keep tenant-scoped query keys and targeted invalidation; broad cache clearing
   is reserved for logout or a security transition, not normal mutations.
6. Use behavior-based tests for user-visible rules, tenant isolation,
   transitions, and repository boundaries.
7. Treat RLS and server-side entitlement checks as final security boundaries;
   frontend guards are UX protection only.
8. Use real tenant UUIDs in Supabase mode; never leak mock IDs into requests or
   hardcode company-specific behavior.
9. Do not create permanent customer branches. Use short-lived feature branches
   and one shared deployment.
10. Do not silently swallow errors. Surface a safe state, retry action, or
    structured development diagnostic.
11. Add comments only for non-obvious business, security, state, cache, session,
    accessibility, versioning, or intentional-debt decisions.
12. Make accessibility and responsive behavior defaults, not late-stage extras.
13. Preserve the approved role, package, and feature scope.

## Global platform version

The global platform version is the shared application release displayed in both
the Company workspace and Platform Admin UI. It is sourced from `package.json`
and rendered as `v0.1.0` by `src/lib/app-version.ts`. It changes only when a
general platform release is deployed to the shared application. Shared
navigation, global UI, authentication, security hardening, HR Core, and shared
infrastructure changes may justify a platform version increment.

Package versions change independently. For example, HR Core `1.1.0`,
Attendance Management `1.0.0`, and Leave Management `1.2.0` may be released to
one, selected, or all companies without changing the global version. A private
extension does not change the global version merely because one company
received it.

## Quality audit rules

Application pages must use shared state, dialog, notification, and query-key
utilities. Hard delete is not a default operation: use disable, terminate,
cancel, archive, or an explicit state transition where the domain supports it.
Every destructive action needs confirmation, pending protection, scoped cache
invalidation, and success/failure feedback. Important errors must also be
visible inline and announced with appropriate semantics; a toast alone is not
an error boundary.

## Deferred work

Employee self-service identity linkage, configurable leave types, full browser
E2E/visual automation, hosted auth seed automation, wildcard custom domains,
advanced attendance, time-series analytics, and enriched diagnostic authoring
remain explicitly deferred. They require a product or deployment decision and
must not be smuggled into a quality-hardening increment.
