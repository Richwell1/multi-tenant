# Engineering Quality Audit

Date: 2026-07-26  
Branch: `chore/engineering-quality-hardening`

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
| `/admin/packages/new` | Package release form | Validation/gate errors | Publish confirmation/toast | Complete |
| `/admin/packages/:key` | Package/version detail | Empty versions/retry | Target/install actions | Complete |
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

## Evidence and remaining work

- Local verification: typecheck, lint, build, and 220 application tests pass.
- CI includes eight SQL/RLS suites with 94 scenarios.
- Supabase mode has repository/adapters and real UUID scoping; no mock IDs are
  intended to reach Supabase requests.
- Full browser smoke testing at 320/375/768/1024/1440 pixels, hosted Auth
  seed verification, and visual regression automation remain deployment tasks.

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
