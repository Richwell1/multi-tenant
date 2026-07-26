# Engineering Quality Audit

Date: 2026-07-26  
Branch: `feat/admin-package-management`

This audit records implementation coverage and known verification boundaries.
It does not claim that hosted browser smoke testing has been completed.

## Shared behavior matrix

| Concern | Current behavior | Status |
|---|---|---|
| Loading | Shared `StateShell`/`TableBoundary` loading states | Complete |
| Empty data | Valid zero-row lists render empty states; usage renders zero metrics | Complete |
| Error | Retryable `ErrorState`; guards distinguish context errors from denial | Complete |
| Success | Query results render table/card states; mutations use central notifications | Complete |
| Warning/suspended | Warning state and company-suspended route are explicit | Complete |
| Delete/destructive | `ConfirmDialog` is used for destructive/recovery actions | Complete |
| Dialogs | Unique title/description IDs, Escape, focus trap, focus restoration | Complete |
| Session | Restore failure exits loading; logout clears local data on remote failure | Complete |
| Version | `APP_VERSION` derives from `package.json` and appears in shared/public UI | Complete |
| Responsive/a11y | Responsive shells, keyboard focus, semantic status/alert roles | Implemented; browser smoke pending |

## Route audit

| Route | Data/behavior | Empty/error/retry | Mutation/dialog/toast | Status |
|---|---|---|---|---|
| `/` | Public landing and portal links | N/A | N/A | Complete |
| `/login` | Auth + tenant portal context | Inline validation/auth error | Auth failure notification | Complete |
| `/register` | Registration Edge Function/service | Field and request errors | Success notification; no reset/MFA | Complete |
| `/access-denied` | Access outcome | Explicit denied state | Return navigation | Complete |
| `/company-suspended` | Company status outcome | Explicit suspended state | Logout/return navigation | Complete |
| `/admin` | Platform metrics, activity, health | Widget-level state; optional failure isolated | No destructive action | Complete |
| `/admin/companies` | Companies + optional enrichment | Empty table and retryable error | Company actions use confirmation where needed | Complete |
| `/admin/companies/:id` | Company detail and assignments | Empty sections/retry | Assignment/recovery confirmations | Complete |
| `/admin/requests` | Request Records list | Empty/no-results/retry | Status changes notify and invalidate | Complete |
| `/admin/requests/new` | Request creation form | Validation/request error | Success toast and redirect | Complete |
| `/admin/requests/:id` | Request detail | Missing/error state | Status/update feedback | Complete |
| `/admin/packages` | Package catalog | Empty/no-results/retry | Release action link | Complete |
| `/admin/packages/new` | Package + initial version creation | Validation/duplicate/retry errors | Success notification; no assignment on creation | Complete |
| `/admin/packages/releases/new` | Release plan and per-company targeting | Validation/gate/target errors | Plan/install notifications; independent failures remain visible | Complete |
| `/admin/packages/:key/versions/new` | Additional package version creation | Validation/duplicate/retry errors | Success notification; no publish or assignment on creation | Complete |
| `/admin/packages/:key` | Package/version detail | Empty versions/retry | Target/install actions | Complete |
| `/admin/releases/:releaseId` | Release plan and installation detail | Empty/retryable installation list | Per-company retry; no bulk failure masking | Complete |
| `/admin/diagnostics` | Diagnostic reports list | Empty/no-results/retry | Run action feedback | Complete |
| `/admin/diagnostics/:id` | Diagnostic checks/report | Empty checks/retry | Release gate state | Complete |
| `/admin/installations` | Installation monitoring | Empty installations/retry | Retry and confirmed rollback | Complete |
| `/admin/usage` | Usage RPC metrics and company filter | Zero metrics/empty companies/retry | Filter only | Complete |
| `/admin/health` | System health RPC | Health signal state/retry | No destructive action | Complete |
| `/admin/audit` | Enriched platform audit RPC | Empty audit/retry | Filter only | Complete |
| `/dashboard` | Company dashboard and entitlements | Empty activity/retry | Package/update actions | Complete |
| `/employees` | Tenant employee list | Empty/no-results/retry | Terminate confirmation/toast | Complete |
| `/employees/new` | Employee form | Validation/request error | Success toast and redirect | Complete |
| `/employees/:id` | Employee profile | Missing/error state | Edit/terminate confirmation | Complete |
| `/departments` | Tenant department list | Empty/no-results/retry | Create/edit feedback | Complete |
| `/positions` | Tenant position list | Empty/no-results/retry | Create/edit feedback | Complete |
| `/updates` | Assigned package updates | Empty updates/retry | Install confirmation/toast | Complete |
| `/packages` | Installed/available packages | Empty package state/retry | Activation feedback | Complete |
| `/users` | Company memberships | Empty/retry | Role/status action feedback | Complete |
| `/settings` | Company settings/profile | Error/retry | Save feedback | Complete |
| `/leave` | Entitlement-gated leave list | Empty/no-results/retry | Decision confirmation/toast | Complete |
| `/attendance` | Entitlement-gated attendance list | Empty/no-results/retry | Check-in/out feedback | Complete |

The route table records the data source, loading/empty/error/success behavior,
destructive action, toast/dialog behavior, and completion status for every
current route. The following cross-cutting audit records the remaining fields
that apply to each route's shared shell and interaction primitives.

## Dialog, modal, and drawer audit

| Surface | Title/description | Focus/keyboard | Mobile/scroll | Pending/close behavior | Status |
|---|---|---|---|---|---|
| `ConfirmDialog` | Unique `useId` title and optional description | Focus trap, Escape, Tab loop, focus return | 90vh max height with internal scrolling | Cancel, backdrop, and Escape disabled while pending; buttons disabled | Complete |
| Admin recovery confirmation | Shared `ConfirmDialog`, impact description | Same shared behavior | Same shared behavior | Rollback remains open until mutation resolves | Complete |
| Workspace terminate/disable confirmations | Shared `ConfirmDialog`, destructive tone where appropriate | Same shared behavior | Same shared behavior | Values/actions remain controlled by page until success | Complete |
| AppShell mobile drawer | Labeled open/close controls and overlay | Escape closes; focus remains keyboard reachable | 86vw max width; navigation scrolls | No repository call; route navigation closes drawer | Complete |

No dialog calls a repository directly. Forms own their values, so mutation
errors preserve entered values; success handlers close or navigate only after a
successful mutation. The shared dialog prevents duplicate submissions and
prevents dismissal during critical pending mutations.

## Authentication and session matrix

| Flow | Expected result | Evidence/status |
|---|---|---|
| Platform Admin login | Authenticates, verifies `platform_admins`, enters `/admin` | Route-guard tests; Complete |
| Company login | Authenticates, resolves membership/company status/entitlements, enters workspace | Route-guard tests; Complete |
| Alpha then logout then Beta | Logout clears session and all cached tenant data before Beta loads | Logout/session tests; Complete |
| Platform logout then company login | Portal context is recomputed from the new URL/session and cannot reuse admin state | Guard/login tests; Complete |
| Browser refresh while signed in | Supabase Auth restores session, then guards resolve context | Supabase adapter implementation; hosted browser smoke pending |
| Expired/failed session restore | Loading ends and the user remains signed out with a safe retry/login path | Session restoration test; Complete |
| Unauthorized tenant | Membership/slug mismatch routes to access denied | Route-guard test; Complete |
| Suspended company | Active membership plus suspended company routes to suspended state | Route-guard test; Complete |
| Inactive membership | Company access is denied | Route-guard test; Complete |

Logout calls the Auth adapter first, then always clears the local session and
TanStack Query cache. The context and entitlement hooks are keyed by the
authenticated user, so they become disabled/recomputed after logout; no prior
company data should remain available to the next session.

## Version audit

- `package.json` is the only platform-version source.
- `APP_VERSION` and `AppVersion` provide the shared display value.
- AppShell displays the value for both Platform Admin and Company workspace;
  public auth screens display it in the footer.
- Package releases retain independent package versions and do not mutate
  `APP_VERSION`; a focused test publishes a package version and asserts the
  platform value is unchanged.
- System health and shell metadata remain covered by the shared version display;
  a separate hardcoded version is not permitted.

## Responsive and accessibility audit fields

Every route inherits responsive shell behavior, visible focus states, semantic
loading/status/alert roles, keyboard-accessible controls, and mobile navigation.
Tables use a bounded overflow surface, toolbars wrap, dialogs fit within the
viewport and scroll internally, and long labels truncate safely. Full manual
browser verification at 320, 375, 768, 1024, and 1440 pixels remains
`Deferred` because the browser runner is unavailable.

## Evidence and remaining work

- Local verification: typecheck, lint, 231 application tests, and production
  build pass. The package-management focused tests are included in that total.
- CI baseline includes eight SQL/RLS suites with 94 scenarios. This branch adds
  one suite with 18 scenarios, for 9 suites and 112 local scenarios.
- Supabase mode has repository/adapters and real UUID scoping; no mock IDs are
  intended to reach Supabase requests.
- Full browser smoke testing at 320/375/768/1024/1440 pixels, hosted Auth
  seed verification, hosted migration deployment, and visual regression
  automation remain deployment tasks.

## Final verification record — 2026-07-26

| Item | Result |
|---|---|
| Branch | `feat/admin-package-management` |
| Commits | Pending feature commit(s) |
| Hosted deployment | Previous schema and 15 migration records/API grants deployed; new package-management migration pending |
| Local database | `npx supabase db reset` passed |
| SQL/RLS | 9/9 suites, 112 scenarios passed |
| Application checks | typecheck, lint, 231 tests, build passed |
| Browser smoke | Deferred: no browser runner available |
| Hosted Auth/demo data | Pending final confirmation |
| Custom domain | Deferred |
| Remaining demo risk | Hosted cross-session tenant-isolation smoke and final Vercel environment verification |

## Code-quality audit

The focused audit found and addressed these proven issues:

- `LazySupabaseRepository` public methods are callback-safe; aggregate method
  coverage and detached-call behavior are tested.
- Supabase repository errors now log safe development diagnostics and avoid
  exposing provider-internal schema/SQL messages to user-facing toasts.
- Supabase-mode company context is used for hosted workspace names and
  subdomains instead of relying on mock company metadata.
- Normal mutations use centralized, scoped invalidation targets. Full query
  cache clearing is reserved for logout/security transitions.
- No page imports or calls Supabase directly; no browser service-role variable
  is supported.

The audit did not find a proven need for a broad component rewrite, a new
error-boundary hierarchy, or a schema/RLS/grant change. Existing non-null
assertions occur behind query `enabled` guards or static app-root mounting and
remain covered by the current type/test boundaries.

## Package-management audit addendum — 2026-07-26

- Package creation is Platform-Admin-only and creates the package plus its first
  version atomically. It intentionally creates no company assignment or
  installation.
- Additional versions are created independently from release publication and
  remain unreleased until a release plan targets companies.
- Release planning validates package classification, diagnostic gate, target
  cardinality, and active-company scope before inserting pending installation
  rows. It does not partially assign entitlements during planning.
- Installation processing locks and updates one installation at a time. A
  company failure records a safe failure code/message and does not cancel other
  companies. Retry reprocesses only the selected failed installation.
- Release detail surfaces show planned, installed, failed, and pending counts,
  attempt count, and sanitized failure details. No provider SQL or credentials
  are rendered.
- The old `publish_package_release` RPC remains for compatibility with existing
  historical fixtures; the new Admin flow uses `create_package_release` plus
  `process_package_installation`.
