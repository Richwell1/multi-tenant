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
- Supabase CLI SQL suites for authenticated RLS and RPC scenarios
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
uses diagnostic results, then creates release targets, installations, and
assignment changes atomically. Installation recovery is a state machine:
retry can recover a failed installation and rollback disables the corresponding
assignment. The UI mirrors valid transitions, but the database remains the
authority.

Package versions (`package_versions`) describe a package release. The platform
application version is separate: `package.json` is the source of truth and
`src/lib/app-version.ts` exposes the `v0.1.0` display value. A package release
must not be mistaken for a platform deployment.

### Classification versus targeting

Classification answers “what kind of change is this?” The supported package
classifications are standard update, shared extension, private customization,
configuration update, bug fix, and security update. Targeting answers “which
companies receive it?” and is independently represented as all companies,
selected companies, or one company. A private customization can target only
one company; a shared extension can target selected or all companies. The
database RPC validates the combination, so the UI is not the final authority.

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
credential.

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
repository boundary. CI runs typecheck, lint, 220 application tests, and a
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
