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
- GitHub Actions and Cloudflare Workers

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer (the npm bundled with supported Node.js is suitable)
- Docker, for local Supabase and SQL/RLS suites
- Supabase CLI 2.105.0 or a compatible current CLI
- Git
- Wrangler CLI is optional (bundled as a devDependency; `npx wrangler` works
  without a separate install)

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

In local dev, company workspaces use **path-based tenant routing** —
`/:companySlug/dashboard`, `/:companySlug/departments`, etc. — since localhost
has no real subdomains (Platform Admin stays at `/admin/...`). In production,
each company gets a real **wildcard subdomain** instead — `acme.merbsconnect.com/dashboard`
— with no slug in the path; see "Deploying to Cloudflare Workers" below. Company
**names may repeat**, but **slugs are globally unique**: the backend derives a
slug from the company name and, on collision, appends a short random suffix
(e.g. `acme-ltd-k7p2`). The slug is only a public routing/subdomain identifier —
the company UUID plus membership and RLS remain the tenant boundary. See
`docs/ARCHITECTURE.md` (“Globally unique slugs”).

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

Never run `db reset --linked`. Configure Auth URL settings under Supabase
Authentication → URL Configuration for every host the app is served from —
since every company gets its own subdomain, this must include a wildcard
entry, not just the marketing host:

```text
https://home.merbsconnect.com/**
https://*.merbsconnect.com/**
http://localhost:5173/**
```

Set `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, and
`VITE_SUPABASE_PUBLISHABLE_KEY` as Cloudflare Worker environment variables (see
below). Do not put function secrets in frontend variables; use
`npx supabase secrets set NAME=value`.

After hosted Auth users are created, their IDs must match
`platform_admins.user_id` or `company_memberships.user_id`. Hosted browser
testing must verify both successful access and Alpha/Beta isolation.

## Deploying to Cloudflare Workers

### Production hosting

```text
Production host:     Cloudflare (Workers Static Assets)
Root domain:         merbsconnect.com
Public host:         home.merbsconnect.com
Platform Admin host: admin.merbsconnect.com
Tenant host format:  <companySlug>.merbsconnect.com
Backend:             Supabase (Postgres, Auth, Edge Functions)
```

Production is served by **Cloudflare, not Vercel**. `vercel.json` survives only
as a historical artifact of the earlier setup; nothing deploys from it and no CI
job targets Vercel.

Every host above serves the **same** deployment — there is no per-host build.
Sharing a deployment (and, since the parent-domain auth cookie, a session) does
**not** share authorization. Each tenant host independently enforces:

- an authenticated Supabase user;
- an active `company_memberships` row;
- the company UUID behind the hostname slug;
- active company status;
- package entitlements;
- Row Level Security on every query.

The app is a static Vite build served by a Cloudflare Worker (Workers Static
Assets), with SPA fallback replacing what `vercel.json`'s rewrite used to do.
Tenant resolution happens entirely client-side from `window.location.hostname`
(`src/lib/tenant.ts`) — there is no server-side routing logic, and **no
per-tenant provisioning step**: once a company's slug exists in the database,
its subdomain works the instant a request hits it, via wildcard DNS.

### Domain layout

- `merbsconnect.com` (bare apex) — **not owned by this deployment**; it
  already serves an unrelated site and is never routed to this Worker.
- `home.merbsconnect.com` — marketing, `/login`, `/register`, and Platform
  Admin (`/admin/...`).
- `<company-slug>.merbsconnect.com` — that company's workspace, e.g.
  `acme.merbsconnect.com/dashboard`. `home`, `www`, and `admin` are reserved
  slugs (`src/lib/slug.ts`, `public.is_reserved_slug()`) so a company can never
  claim them.

### One-time Cloudflare setup

1. In the Cloudflare dashboard for the `merbsconnect.com` zone, add a
   **proxied** (orange-cloud) DNS record for the wildcard: type `CNAME`, name
   `*`, target `merbsconnect.com`. This is required for `home.merbsconnect.com`
   and every `<slug>.merbsconnect.com` to reach the Worker — Cloudflare
   Workers Routes (as opposed to Custom Domains) do not create DNS records for
   you.
2. Universal SSL then covers `*.merbsconnect.com` automatically — no
   certificate management needed.
3. `wrangler.jsonc` in this repo already declares the matching route
   (`*.merbsconnect.com/*`) and the static-assets/SPA config. Nothing else to
   configure per-tenant.

### Deploy

```bash
npx wrangler login       # once, authenticates the CLI to your Cloudflare account
npm run deploy            # builds (tsc -b && vite build) and runs `wrangler deploy`
```

All four `VITE_*` variables must be present at **build** time — Vite inlines
them into the bundle, so setting them on the Worker afterwards has no effect.

For a manual `npm run deploy`, export them in your shell (or put the non-secret
ones in `wrangler.jsonc`'s `vars`). For the real production deploy they come
from the CI job — see below.

### `VITE_APP_DOMAIN` — required

```text
VITE_APP_DOMAIN=merbsconnect.com
```

**Authoritative source: `.github/workflows/ci.yml`** (the `deploy` job's `env`).
CI performs the production build, so that file — not the Cloudflare dashboard —
is what actually determines the deployed value. It is a plain literal, not a
secret, so it is reviewable in version control and cannot drift silently.

This variable is **required, not optional**. It:

- configures the parent-domain authentication cookie
  (`Domain=.merbsconnect.com`, see `src/lib/auth-storage.ts`);
- lets one Supabase browser session be shared across the trusted subdomains;
- makes one-login navigation from `home.merbsconnect.com` to a company
  workspace work without a second sign-in;
- ensures signing out clears the shared session on every subdomain.

> **Warning:** `VITE_APP_DOMAIN` is required for cross-subdomain authentication.
> If the value is missing, malformed, or does not match the production root
> domain, the auth cookie falls back to **host-only** scope. The double-login
> problem then returns: users signing in on `home.merbsconnect.com` are asked
> for their credentials again on `<companySlug>.merbsconnect.com`. The
> application code can be entirely correct and the bug will still reappear.

Security properties worth knowing before changing the domain layout:

- The cookie is **browser-readable and not `HttpOnly`** — the Supabase client
  must read and rewrite the tokens. XSS exposure is comparable to the
  `localStorage` it replaced; this buys correct cross-subdomain behaviour, not
  stronger token secrecy.
- **Authentication is shared; authorization is not.** Every tenant host still
  verifies membership and the company UUID behind the hostname.
- The cookie is sent to **all** `*.merbsconnect.com` hosts. That is safe today
  because every host is the same application. **Do not add a differently
  trusted subdomain without reviewing this trust boundary first.**

### Continuous deployment (GitHub Actions)

`.github/workflows/ci.yml` has a `deploy` job that runs after `quality`
passes, only on pushes to `main` (or a manual `workflow_dispatch` run from the
Actions tab) — never on pull requests. It runs `npm ci`, builds with the `VITE_*`
values below, and then calls `npx wrangler deploy` **directly** rather than using
`cloudflare/wrangler-action` — the action's bundled Wrangler 3.x cannot deploy an
assets-only (no `main`) Worker, and its `wranglerVersion` input did not override
that default.

Configure these as **GitHub repository secrets** (Settings → Secrets and
variables → Actions) before the first deploy:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A scoped token with **Edit Cloudflare Workers** permission, restricted to this account (create under Cloudflare dashboard → My Profile → API Tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (dashboard sidebar, or `wrangler whoami`) |
| `VITE_SUPABASE_URL` | Same value as your hosted `.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same value as your hosted `.env` (publishable/anon key only) |

`VITE_APP_DOMAIN` is set as a literal in the workflow rather than a secret — it
is a public hostname, and keeping it in version control makes the value
reviewable.

`npm run cf:dev` runs `wrangler dev` for a local Cloudflare-flavored preview
(distinct from `npm run dev`'s Vite dev server, which remains the primary
local dev loop with path-based tenant routing).

### Production deployment checklist

The last four items need a **real browser** — they exercise client-side
redirects and cookie scoping that no HTTP client can observe.

```text
[ ] Confirm `VITE_APP_DOMAIN` is set to `merbsconnect.com` in `.github/workflows/ci.yml`.
[ ] Confirm the production build received the expected value.
[ ] Confirm login at `https://home.merbsconnect.com/login` redirects to `https://<companySlug>.merbsconnect.com/dashboard` without a second login.
[ ] Confirm logout clears the session on both the public and tenant hosts.
[ ] Confirm Company Admin users cannot access Platform Admin routes.
[ ] Confirm changing the tenant hostname does not bypass membership or RLS.
```

To check the second item without a browser, confirm the deployed bundle contains
the expected domain — the value is inlined at build time:

```bash
BUNDLE=$(curl -s https://home.merbsconnect.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://home.merbsconnect.com/$BUNDLE" | grep -c 'merbsconnect\.com'
```

For the cookie itself, use **DevTools → Application → Cookies** and confirm the
Supabase auth cookie is scoped to `.merbsconnect.com` with `Path=/`, `Secure`,
and `SameSite=Lax`. It is written by JavaScript via `document.cookie`, never in
an HTTP response header, so it is invisible to `curl`.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:rls
npm run build
```

GitHub Actions runs local Supabase startup/reset, every committed SQL/RLS suite,
typecheck, lint, application tests, and the production build on pull requests and
pushes to `main`.

The CI job starts Supabase with optional containers excluded:

```bash
supabase start -x analytics,vector,studio,imgproxy,inbucket
```

- **CI only.** `supabase/config.toml` is untouched, so `supabase start` locally
  still brings up Studio and everything else.
- Nothing in the quality job uses those services: the SQL/RLS suites connect to
  Postgres directly and the application tests are fully mocked, so only the `db`
  container is genuinely exercised.
- It was introduced after `supabase db reset` failed on CI with
  `Error status 502: An invalid response was received from the upstream server`
  during `Restarting containers…` — Kong reporting an unhealthy upstream when
  the analytics (Logflare) container and its `vector` log shipper missed their
  health check on the runner. Every migration had already applied cleanly; the
  failure was infrastructure, not schema.
- **This is not a production runtime setting.** It affects only how the CI
  runner starts a throwaway local Supabase stack.

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
6. deploy the shared application to Cloudflare Workers (see "Deploying to
   Cloudflare Workers" above).

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

### Blank page or SPA 404 on Cloudflare

Confirm `wrangler.jsonc`'s `assets.directory` points at a built `dist`
(`npm run build` ran first), `not_found_handling` is
`"single-page-application"`, and the deployed environment variables are
configured. Redeploy after changing build-time variables.

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

### Stale Cloudflare deployment or cache

Verify the deployed Worker version (`wrangler versions list`), the deployed
environment scope, and all `VITE_*` build-time variables. Redeploy after
changing build-time variables, then use a hard refresh or a fresh browser
session. Do not debug a stale bundle by adding secrets to source code.

### Tenant subdomain resolves to the wrong host, or not at all

Confirm the wildcard DNS record (`*` → `merbsconnect.com`, proxied) exists and
is orange-clouded, and that `wrangler.jsonc`'s route
(`*.merbsconnect.com/*`) is deployed. A slug that collides with a reserved
word (`home`, `www`, `admin`, …) is rejected at registration — see
`src/lib/slug.ts` — so this is a DNS/route issue, not a slug-allocation bug.

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
advanced incident management. Wildcard-subdomain tenant routing on Cloudflare
Workers is implemented (see "Deploying to Cloudflare Workers"); a fully custom
per-tenant domain (bring-your-own-domain, beyond the shared wildcard) remains
deferred deployment work.
