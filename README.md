# Multi-Tenants HR

Multi-Tenants HR is a lightweight multi-tenant HR ERP demonstration. It uses
one React application and one Supabase project to demonstrate company
registration, tenant isolation, role-based access, HR Core, optional packages,
package releases, diagnostics, and platform operations.

The product has two portals:

- Platform Admin: companies, request records, package releases, installations,
  diagnostics, usage, audit, and system health.
- Company workspace: employees, departments, positions, users, settings,
  updates, installed packages, and entitled optional modules.

HR Core is automatically assigned to every company and contains only
Employees, Departments, and Positions. Leave Management and Attendance are
optional packages. Package classification describes the change; release
targeting decides whether it reaches all companies, selected companies, or one
company.

## Architecture

```text
Routes / Pages
  → feature components and shared shells
  → TanStack Query hooks
  → application services
  → repository interfaces
  → mock or Supabase adapters
  → Supabase Auth / PostgreSQL / RLS / RPCs / Edge Functions
```

Pages do not call Supabase directly. Repository adapters are the data boundary;
the mock provider is useful for deterministic demos and the Supabase provider
handles hosted/local persistence. Frontend guards improve UX, but Supabase RLS
and server-side authorization are the final security boundary. Tenant-owned
records are company-scoped, query keys include the company identifier, and
service-role credentials never enter browser code.

## Technology

- React 18 and TypeScript
- Vite and Tailwind CSS
- shadcn/ui-style hand-authored primitives using CVA and `tailwind-merge`
  (the primitives are maintained in `src/components/ui`; there is no separate
  shadcn package to install)
- TanStack Router and TanStack Query
- React Hook Form and Zod
- Sonner notifications
- Supabase Auth, PostgreSQL, RLS, RPCs, and Edge Functions
- Vitest and React Testing Library
- GitHub Actions and Vercel

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer (the npm bundled with supported Node.js is suitable)
- Docker, for local Supabase and SQL/RLS suites
- Supabase CLI 2.105.0 or a compatible current CLI
- Git
- Vercel CLI is optional

The repository uses the Node and Supabase versions pinned by CI. Check
`.github/workflows/ci.yml` and `package.json` when upgrading them.

## Clone and install

```bash
git clone https://github.com/Richwell1/multi-tenant.git
cd multi-tenant
npm ci
cp .env.example .env
```

`.env`, `.env.local`, and other local environment variants are ignored by
`.gitignore`. Never commit service-role keys, database passwords, access
tokens, or real production credentials; production secrets belong in the
hosting/provider secret stores, not in Vite source variables.

## Environment

The browser reads only these variables:

```env
VITE_DATA_SOURCE=mock
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_DATA_SOURCE=mock` runs the deterministic seeded demo. Set it to
`supabase` for local or hosted Supabase persistence. The publishable/anon key
is appropriate for browser use; a service-role key is only used inside the
server-side registration Edge Function.

## Run in mock mode

```bash
npm run dev
```

Open `http://localhost:5173`. The shared login is available at:

- `/login?portal=admin` for Platform Admin
- `/login?tenant=alpha` for the Alpha workspace
- `/login?tenant=beta` for the Beta workspace
- `/register` for company registration

Mock data includes Alpha Trading, Beta Manufacturing, and a suspended company.
The mock adapter accepts demo credentials; password `wrong` exercises the
inline invalid-credentials state.

## Run local Supabase

Docker must be running. This project intentionally uses ports offset from the
defaults:

| Service | URL / port |
| --- | --- |
| API and Functions | `http://127.0.0.1:54331` |
| Postgres | `127.0.0.1:54332` |
| Studio | `http://127.0.0.1:54333` |
| Inbucket | `http://127.0.0.1:54334` |

The source of truth is `supabase/config.toml`.

```bash
npx supabase start
npx supabase db reset
npm run test:rls
VITE_DATA_SOURCE=supabase npm run dev
```

`supabase db reset` is safe for the local stack. Do not use
`npx supabase db reset --linked`; that targets the hosted project.

Use `npx supabase status` to retrieve the local API URL and publishable/anon
key. Studio is available at the configured Studio URL. The local stack applies
all committed migrations and `supabase/seed.sql`.

## Hosted Supabase

The hosted project must be linked before deployment. Use the project reference
provided by Supabase; do not commit it as a browser secret:

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy register-company
```

Never run `db reset --linked`. Configure Auth URL settings for the deployed
Vercel URL under Supabase Authentication → URL Configuration. Keep the local
redirect during development, for example:

```text
https://<your-vercel-domain>/**
http://localhost:5173/**
```

Set
`VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, and
`VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. Do not put function secrets in
frontend variables; use `npx supabase secrets set NAME=value`.

After hosted Auth users are created, their IDs must match
`platform_admins.user_id` or `company_memberships.user_id`. Hosted browser
testing must verify both successful access and Alpha/Beta isolation.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:rls
npm run build
```

GitHub Actions runs local Supabase startup/reset, all nine SQL/RLS suites (112
security scenarios), typecheck, lint, application tests, and the production
build on pull requests and pushes to `main`.

## Routes

Public routes: `/`, `/login`, `/register`, `/access-denied`, and
`/company-suspended`.

Platform Admin routes: `/admin`, `/admin/companies`, company details,
`/admin/requests`, request creation/details, `/admin/packages`, new package,
new package version, release creation/details, package details,
`/admin/diagnostics`, diagnostic details,
`/admin/installations`, `/admin/usage`, `/admin/health`, and `/admin/audit`.

Company routes: `/dashboard`, `/employees`, employee creation/details,
`/departments`, `/positions`, `/updates`, `/packages`, `/users`, `/settings`,
`/leave`, and `/attendance`. Leave and Attendance are guarded by package
entitlements and remain server-protected by RLS.

## Versioning

The global platform version is read from `package.json` by
`src/lib/app-version.ts` and rendered through the shared `AppVersion` component.
The initial value is `v0.1.0` and is shown in the authenticated shell and auth
footer.

The global version changes only for an intentional shared application release:

1. choose a semantic-version change;
2. update `package.json` and `CHANGELOG.md`;
3. run all quality checks;
4. commit and open a pull request;
5. merge after CI passes; and
6. let Vercel deploy the shared application.

Package versions are independent. A private, selected-company, or all-company
package release changes that package's installation/entitlement version. It
does not change `APP_VERSION` unless the shared frontend is intentionally
released too.

### Package classification and targeting

Classification describes what kind of change a release contains:

- `standard_update`: a normal shared product update
- `private_extension`: a customer-specific extension that depends on a base
  package (the target company must already have that base package enabled)
- `private_customization`: a standalone customer-specific package (no base)
- `shared_extension`: an extension intended for multiple companies
- `configuration_update`: a configuration change
- `bug_fix`: a defect correction
- `security_update`: a security correction

Targeting describes who receives the release and is validated separately from
classification: all active companies, selected companies, or one company.
Private customizations and private extensions are limited to one company; shared
extensions may target selected or all companies. A private extension can only be
released to a company that already has its base package enabled. The database
release RPC is the final authority for these rules.

When "Install automatically" is checked, publishing enables every active
target's entitlement and marks it installed in one transaction; if any target
fails, the whole release rolls back with a clear error (no partial state).

New companies receive the latest **released, diagnostic-PASS, highest semantic
version** of HR Core at registration (never a hardcoded version); publishing a
newer all-company HR Core release becomes the default for future registrations.
Only HR Core is assigned automatically — private packages and extensions are
never auto-assigned during registration.

### Package versions and feature gating

Features are gated on the company's **installed package version**, not just the
entitlement. A centralized manifest (`src/lib/packages/manifest.ts`) is the
single source mapping each package version to the features it exposes and the
minimum version that unlocks each:

```text
HR Core 1.0.0 → Departments
HR Core 1.1.0 → Departments + Employees
Attendance Management 1.0.0 → Attendance
```

Sidebar navigation, direct route access, and page rendering all check the
installed version (Employees requires HR Core ≥ 1.1.0; Attendance requires
Attendance ≥ 1.0.0). The company's Installed Packages page shows each package's
name, installed version, and available features — kept separate from the
platform `APP_VERSION` (`package.json`), which package releases never change.
When the Platform Admin publishes HR Core 1.1.0 to all active companies,
existing companies move to 1.1.0 (Employees appears) and newly registered
companies start on the latest released version automatically.

### Distribution models and the marketplace

Packages carry a **category** that controls who installs them and whether they
are discoverable:

- `standard_package` — mandatory, platform-installed to all active companies.
- `marketplace_extension` — optional; a `company_admin` self-installs it from the
  **Extensions Marketplace**. The server (`install_marketplace_extension`) verifies
  the company is active, the caller is an active `company_admin`, the package is an
  active marketplace extension, the version is released with diagnostics PASS,
  dependencies are satisfied, and it is not already installed. A company can never
  install a private package by submitting its key.
- `private_standalone` — a unique feature for exactly one company; Platform-Admin
  assigned, hidden from the marketplace, no base dependency.
- `private_extension` — a private modification of a base package for one company;
  requires the base package (and a minimum base version where set, e.g. HR Core
  ≥ 1.1.0).

Every entitlement records an **installation_source** (`platform_push`,
`company_marketplace`, `private_assignment`, `registration_default`) so the
Platform Admin can see how each package reached each company. The admin
**Adoption** page shows install counts per marketplace extension.

The UI never shows raw enum values. A centralized mapper
(`src/lib/packages/category.ts`) turns `packages.category` into human labels —
**System Package**, **Marketplace Extension**, **Private Extension**, **Private
Standalone Package** — with derived visibility (Platform managed / Marketplace /
Private). The admin Packages table columns are Package · Category · Visibility ·
Base Package · Status, with category filters.

**Available Updates** (company side) shows only what the Platform Admin assigned
or released to that company: pending System Package, Private Extension, and
Private Standalone installs. Uninstalled marketplace packages stay in the
Marketplace; auto-pushed marketplace updates apply immediately rather than
lingering as pending. A company_admin installs each update from its card
(`install_company_update` — base/version gated, own-company only). The sidebar
shows a pending-update count badge (hidden at 0, `9+` above nine) with a
reduced-motion-aware pulse, from one shared query that is cleared on logout and
scoped per company.

**Update matrix** (package versions never change the platform `APP_VERSION`):

| Action | Who moves |
|---|---|
| Standard update to all companies | every active company's installed version |
| Marketplace install | only the installing company |
| Marketplace update | only companies already entitled to that package |
| Private extension / standalone update | only its assigned company |

### Release lifecycle

Creating a package creates metadata and its initial version; it does not
generate feature code. Package implementation remains in this shared codebase:
routes, navigation, services, repositories, tables, and RLS must all be
package-aware. A private package still uses the same deployment and never
creates a permanent customer branch or customer deployment.

The lifecycle is:

```text
Request → classification → package definition → shared-code implementation
→ version creation → diagnostics → release plan → target installations
→ monitoring → retry/rollback/deprecation
```

The release plan is atomic only for planning: it creates one release, target
rows, and one pending installation per active target. Automatic installation
then processes each installation independently. Alpha can succeed while Beta
fails; a retry processes only Beta. A diagnostic release gate runs before
planning; an installation can be pending, installing, installed, failed,
retrying, or rolled back. Rollback disables the affected assignment so
entitlement checks change with the installation state.

## UI state, deletes, and notifications

Pages use shared loading, refreshing, empty, no-results, success, warning,
error, access-denied, suspended, package-unavailable, retry, and installation
state components. Zero rows are valid data, not failures. Forms show inline
validation; mutation errors have useful inline or state-panel explanations;
toasts supplement, rather than replace, important content.

The product does not expose general hard-delete actions. Supported destructive
or irreversible actions use the domain transition intended for that record:
disable, terminate, cancel, rollback, or status change. They require a
confirmation dialog, disable duplicate submission while pending, show success
or failure feedback, and invalidate only affected query-key scopes.

Sonner messages are centralized in `src/lib/notify.ts`. Success messages are
emitted only from mutation success callbacks, errors are mapped to safe user
messages, and logout clears cached tenant data even when remote sign-out fails.

## Branch and contribution workflow

- Start from an updated `main`.
- Use a short-lived branch for one focused change.
- Keep pages small and preserve pages → hooks → services → repositories.
- Use conventional commit messages.
- Run typecheck, lint, tests, and build before committing.
- Open a pull request; do not push directly to `main`.
- Merge only after review and the hosted CI quality gate pass.

Engineering principles are mandatory: single responsibility, separation of
concerns, dependency inversion, DRY, KISS, YAGNI, composition over duplication,
explicit TypeScript types, centralized validation and error mapping,
tenant-scoped query keys, targeted invalidation, behavior-based tests,
accessibility by default, and responsive design by default. Do not hardcode
company behavior, create permanent customer branches, silently swallow errors,
use broad cache invalidation for ordinary mutations, or call Supabase directly
from pages.

The full mandatory rules are documented in `AGENTS.md` and
`docs/ARCHITECTURE.md`.

## Troubleshooting

### Blank Vercel page or SPA 404

Confirm the deployment contains `dist`, the Vercel rewrite in `vercel.json` is
present, and the deployed environment variables are configured. Redeploy after
changing variables.

### Missing environment variables

Copy `.env.example` to `.env`, set the three `VITE_*` values, and restart Vite.
Never fix this by adding a service-role key to the browser.

### Auth user exists but access is denied

The Auth user must also have a matching row in `platform_admins` or
`company_memberships`. Check that the membership is active and the company is
active; then sign out and back in to refresh the session context.

### Platform Admin is missing

Confirm the authenticated user's UUID exactly matches `platform_admins.user_id`.
An email address alone does not authorize the platform portal. Inspect the
authenticated request and database row before changing RLS or grants.

### Company user is missing

Confirm the authenticated user's UUID exactly matches an active
`company_memberships.user_id`, with the correct `company_id`, role, and active
company status. Do not create an unrelated membership UUID.

### Slug passed where UUID is required

Tenant slugs are routing identifiers. Supabase table queries use the real
company UUID returned by the membership context. Do not send `alpha` where a
UUID column is expected.

### RLS versus Data API grants

RLS controls visible rows after a table/function is exposed. A 403/404 can also
mean the authenticated role lacks Data API access. Inspect grants and the
exposure configuration before changing policies.

### Docker unavailable

Mock mode still runs without Docker. SQL/RLS verification requires Docker and
the local Supabase stack.

### Stale Vercel deployment or cache

Verify the deployment commit, production environment scope, and all three
`VITE_*` variables. Redeploy after changing build-time variables, then use a
hard refresh or a fresh browser session. Do not debug a stale bundle by adding
secrets to source code.

### RLS versus Data API access

RLS decides which rows an exposed table returns. Data API exposure and grants
decide whether the authenticated role can access the table at all. A 403 or
404 must be identified from the request response before either policy or grant
is changed.

### Lazy repository callback binding

Lazy repository methods are arrow properties so passing a method to a query or
mutation cannot lose its `this` context. Prefer closures in hooks for clarity.

## Scope restrictions

This demo intentionally does not include MFA, OTP, password reset, invitation
onboarding, social login, in-app chat, company request submission, payroll,
recruitment, performance management, billing, microservices, Kubernetes, or
advanced incident management. Custom domains and wildcard subdomains remain
deferred deployment work.
