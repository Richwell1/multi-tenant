# Implementation Progress — Multi-Tenants HR

> Single operational progress tracker. Keep concise; do not duplicate README/ARCHITECTURE.
> Update after every successful increment.

## Project summary

| | |
|---|---|
| Product | Multi-Tenants HR |
| Current branch | `chore/engineering-quality-hardening` |
| Current phase | Engineering quality, documentation, UX state, session, and versioning hardening |
| Current increment | Cross-cutting quality hardening after Phase 6.1 |
| Default data source | `mock` (`VITE_DATA_SOURCE`), Supabase path behind lazy adapters |
| Local Supabase ports | API/Functions 54331 · DB 54332 · Studio 54333 (project-local +10 offset) |
| Hosted Supabase | Linked (`uezvaqoqqqgblpcbkujq`); 15 migrations and required API grants deployed |
| Test count | 220 application tests |

> `main` carries everything through 5.6 and the hosted Supabase baseline is deployed. The hosted CI quality gate passed the full
> SQL/RLS matrix and application checks. RLS suites under `supabase/tests/`:
> `package_release_rls.sql` (10), `leave_rls.sql` (14), `attendance_rls.sql` (18),
> `request_records_rls.sql` (10), `diagnostics_rls.sql` (14),
> `installation_recovery_rls.sql` (12), `usage_analytics_rls.sql` (7),
> `audit_health_rls.sql` (9) — **94 scenarios**. Phase 5 is complete; Phase 6.1
> now applies the validated migrations to hosted Supabase.

## Phase tracker

| Phase | Increment | Status | Completed | Branch | Commit | Verification | Remaining risks |
|---|---|---|---|---|---|---|---|
| 1 | Supabase foundation + tenancy schema | Complete | 2026-07-25 | (merged into 5024176) | — | reset/RLS/types ✅ | — |
| 2 | Auth boundary + atomic onboarding | Complete | 2026-07-25 | main | `5024176` | Edge+SQL ✅ | hosted email-confirm flow |
| 2.5 | Live route guards + membership resolution | Complete | 2026-07-25 | feat/live-route-guards | `f490c95` | 114 tests ✅ | not merged to main |
| 3A | Departments | Complete | 2026-07-25 | feat/hr-core-persistence | `59b7276` | 119 tests + JWT RLS ✅ | mock simulated writes |
| 3B | Positions | Complete | 2026-07-25 | feat/hr-core-persistence | `f6674b9` | 126 tests + JWT RLS+FK ✅ | mock simulated writes |
| 3C | Employees | Complete | 2026-07-25 | feat/hr-core-persistence | `b0bb3f6` | 134 tests + JWT RLS (dual FK, uniqueness, terminate audit) ✅ | browser E2E deferred |
| 4 | Package & extension system | In progress | — | feat/package-release-management | `f4c1888` | 4.1 ✅; 4.2a ✅; 4.2b ✅ (publish RPC + JWT: authz, classification rules, entitlement refresh, tenant-safe installs) | Attendance persistence remains |
| 4.3A | Leave Management persistence | Complete | 2026-07-25 | feat/leave-management-persistence | `554e9d0` | merged (PR #7) + 14 JWT/RLS ✅ | writes scoped to company_admin; self-service + leave_types table deferred |
| 4.3B | Attendance Management persistence | Complete | 2026-07-25 | feat/attendance-management-persistence | migration `110000` | 182 combined + 18 JWT/RLS ✅ | re-sequenced after 5.1; merges `main` for combined verify |
| UI | UI/UX polish | In progress | 2026-07-25 | feat/ui-ux-polish | see `git log` | audit + shared foundation + dialog test + 137 tests ✅ | rebase onto updated main before merge |
| 5.1 | Request Records persistence | Complete | 2026-07-25 | feat/request-records-persistence | merged (PR #8/#9) | 169 tests + 10 JWT/RLS ✅ | platform-admin-only; diagnostic FK completed in 5.2 |
| 5.2 | Diagnostics & Release Gate | Complete | 2026-07-25 | feat/diagnostics-release-gate | merged (PR #10) | 188 tests + 14 JWT/RLS ✅ | authoring UI (per-check status) deferred |
| 5.3 | Installation Monitoring & Recovery | Complete | 2026-07-25 | feat/installation-monitoring-recovery | merged (PR #11) | 194 tests + 12 JWT/RLS ✅ | retry/rollback reconcile entitlements |
| 5.4 | Usage Analytics | Complete | 2026-07-25 | feat/usage-analytics | merged (PR #12) | 197 tests + 7 JWT/RLS ✅ | audit-derived; time-series deferred |
| 5.5 | Audit Surfaces & System Health | Complete | 2026-07-25 | feat/audit-health-surfaces | (this branch) | 201 tests + 9 JWT/RLS ✅ | enriched audit view; derived health |
| 5.6 | CI automation | Complete | 2026-07-25 | feat/ci-security-suites | merged (PR #14) | hosted CI: 8 SQL/RLS suites (94 scenarios) + typecheck/lint/201 tests/build ✅ | browser E2E and hosted deployment remain |
| 6.1 | Hosted Supabase deployment | In progress | 2026-07-25 | feat/hosted-supabase-deployment | merged to main | hosted schema: 15 migrations, API grants, Edge Function, 8 SQL suites, 94 scenarios ✅ | hosted Auth users/seed, final Vercel env verification, and browser isolation smoke remain |
| 6 | Deployment / security hardening / subdomains | Not started | — | — | — | — | wildcard DNS, hosted deploy |

## Milestone checklists

### Supabase foundation
- [x] CLI + local stack + linked project
- [x] Foundation tables + RLS + helper functions
- [x] HR Core package seed
- [x] Generated TypeScript types
- [x] Repository factory + error mapping

### Authentication
- [x] AuthRepository boundary (mock + lazy Supabase)
- [x] Session restore + auth listener + logout cache clear
- [x] Atomic `register-company` Edge Function (service-role server-only)
- [ ] Hosted email-confirmation path

### Tenant isolation
- [x] `company_id` on every tenant table
- [x] RLS forced on HR Core tables
- [x] JWT-based cross-tenant read/insert denial (departments, positions)
- [x] Same-company composite FKs (positions→departments)
- [ ] End-to-end browser isolation under Supabase source

### HR Core
- [x] Departments (persist + RLS + audit)
- [x] Positions (persist + RLS + same-company FK + audit)
- [x] Employees (persist + RLS + dual same-company FKs + terminate + audit)

### Package entitlements
- [x] Real entitlements (`enabledPackageCodes` from context; enabled ∧ is_active) as single source
- [x] Reusable route-level `PackageGuard` (Open/Closed via `packageCode`)
- [x] Release schema (package_releases / targets / installations) + atomic `publish_package_release` RPC (Platform-Admin-only, DB-enforced classification→target rules)
- [x] Package repositories/services (mock + lazy Supabase; publish via RPC) + Admin UI wiring (Create Release, Package Details, Installation Monitoring, Company assignments)
- [x] Leave persistence (entitlement-gated + RLS + status machine + audit)
- [x] Attendance persistence (entitlement-gated + RLS + check-in/out machine + audit; migration `110000`)

### Platform Operations (Phase 5)
- [x] **5.1 Request Records** — `request_records` table; `request_priority` + `request_status` enums; platform-admin-only RLS (all ops); DB-enforced lifecycle (`request_status_can_transition`) mirrored in `src/data/requests/transitions.ts`; `request.{created,status_changed,updated}` audit; repositories (mock + lazy Supabase) + service + hooks; Admin UI rewired (status dropdown offers only valid next states); 10 JWT/RLS scenarios + unit tests
- [x] **5.2 Diagnostics & Release Gate** — `diagnostic_reports` + `diagnostic_checks` (8 dimensions × PASS/WARN/FAIL, `required` flag); result derived (FAIL>WARN>PASS) by trigger and synced to `package_versions.diagnostic_status`; completed the deferred `request_records.diagnostic_id` FK; **release gate** in `publish_package_release` (required FAIL blocks) + `version_release_blocked()` helper, mirrored in the publish UI + `@/data/diagnostics` (`deriveResult`/`isReleaseBlocked`); platform-admin-only RLS; `diagnostic.{created,evaluated}` audit; repositories (mock + lazy Supabase) + service + hooks; Diagnostic Report page shows per-dimension checks; 14 JWT/RLS/gate scenarios + unit tests
  - [ ] Diagnostic **authoring UI** (set per-check status/required, run-on-demand button) — deferred; `run()` creates an all-PASS report and the DB/seed cover WARN/FAIL
- [x] **5.3 Installation Monitoring & Recovery** — installation state machine (`installation_can_transition` + enforce trigger); Platform-Admin-only `retry_package_installation` (failed→installed, **re-enables** `company_packages`) and `rollback_package_installation` (installed→rolled_back, **disables** the assignment so the tenant loses access via `can_use_company_package`); `installation.{retried,rolled_back}` audit; repository (mock + lazy Supabase RPC) + service + hooks + `InstallationsPage` recovery actions (Retry / confirmed Roll back); 12 JWT/RLS scenarios + unit tests
- [x] **5.4 Usage Analytics** — `usage_metrics(company_ids)` SECURITY DEFINER function **derives** per-module metrics (action count + distinct companies) from `audit_logs` (action prefix = module); platform-admin self-gated (non-admin → empty); company-target filter; usage module (mock + lazy Supabase RPC) + service + hook; `UsagePage` rewired; 7 JWT/RLS scenarios + unit tests
- [x] **5.5 Audit Surfaces & System Health** — `platform_audit_log(company_ids, limit)` SECURITY DEFINER enriches audit rows (actor **email** via `auth.users` join + company name), platform-admin self-gated, company-filtered, recent-first; `system_health()` derives live signals (DB online, active companies, **failed installations → degraded**, 24h activity); audit + health modules (mock + lazy Supabase RPC) + services + hooks; `AuditPage`/`HealthPage` rewired; 9 JWT/RLS scenarios + unit tests
- [x] **5.6 CI automation** — `.github/workflows/ci.yml` starts/resets local Supabase, runs all 8 committed SQL/RLS suites (94 scenarios), then typecheck/lint/unit tests/build; cleanup always runs

### Leave Management (4.3A)
- [x] `leave_requests` table; same-company composite FK `(company_id, employee_id)→employees`
- [x] `can_use_company_package()` helper = active member ∧ active company ∧ enabled+active package
- [x] Entitlement-backed RLS (read: entitled member; write: entitled + `company_admin` + matching `company_id`)
- [x] Status machine `pending → approved|rejected|cancelled` enforced in DB trigger **and** service
- [x] Server-side reviewer stamping from `auth.uid()` (no client spoofing); `leave.*` audit events
- [x] Repositories (mock + lazy Supabase) + service + hooks; Leave UI wired (Add Request + decisions)
- [x] 14 JWT/RLS scenarios (`supabase/tests/leave_rls.sql`) + unit tests
- [ ] Employee self-service (company_user creates own requests) — deferred (identity linkage)
- [ ] Per-company `leave_types` table + composite FK — deferred (no leave-type UI; enum used)

### Hosted deployment
- [x] Push all 15 migrations to hosted Supabase (14 schema migrations + API grants); remote history matches local
- [x] Deploy `register-company` Edge Function (active, version 1)
- [x] Vercel frontend deploy is available
- [ ] Verify production Vercel Supabase variables and hosted Auth redirect configuration

### Wildcard subdomains
- [ ] Wildcard DNS + custom-domain tenant resolution

### Production readiness
- [ ] Full RLS/role test matrix
- [ ] CI gates + smoke tests
- [ ] Monitoring / error logging

### 4.3A explicit sign-off notes
- **Leave types:** Fixed PostgreSQL enum for MVP. Tenant-configurable leave types deferred until a management UI and business requirement exist (upgrade path recorded above).
- **Roles:** `company_admin` may write and review; `company_user` is read-only. Employee self-service deferred until reliable auth-user-to-employee identity linkage exists. `hr_manager` is **not** introduced (do not add it indirectly until the role model is deliberately expanded).
- **Browser E2E:** Deferred; manual checklist documented (see Next actions).
- **Integration:** This branch must be merged **after** `feat/package-release-management` and verified against the combined migration + test baseline (both share the package-assignment infrastructure).

### Engineering quality hardening — 2026-07-26

- Branch: `chore/engineering-quality-hardening`
- Updated onboarding, architecture, PRD consistency, overview, changelog, UI/UX
  progress, and this tracker without changing the approved product scope.
- Added a shared `v0.1.0` display sourced from `package.json`.
- Made session restore and logout failure-safe, added retryable guard context
  errors, strengthened dialog focus/IDs, and corrected error-state semantics.
- Centralized safe Supabase error mapping and expanded notification helpers;
  provider-internal schema/SQL messages are no longer shown in UI errors.
- Local verification: typecheck ✅ · lint ✅ · 220 application tests ✅ · build ✅.
- SQL/RLS verification was attempted but is blocked in this environment because
  `psql` and the local Supabase Docker database are unavailable.
- Hosted browser visual, keyboard, and tenant-isolation smoke remains pending.

## Verification history

| Increment | db reset | typecheck | lint | tests | build | RLS/JWT | notes |
|---|---|---|---|---|---|---|---|
| 3A Departments | ✅ | ✅ | ✅ | 119 | ✅ | ✅ | dept adapter lazy chunk |
| 3B Positions | ✅ | ✅ | ✅ | 126 | ✅ | ✅ (+composite FK) | position adapter lazy chunk |
| 3C Employees | ✅ | ✅ | ✅ | 134 | ✅ | ✅ (dual FK, per-company unique #/email, terminate audit) | employee adapter lazy chunk; browser E2E deferred |
| 4.1 Package entitlements + guard | ✅ | ✅ | ✅ | 136 | ✅ | ✅ (company_packages entitlement isolation) | bundle unchanged (471 KB) |
| 4.2a Release backend (RPC) | ✅ | ✅ | ✅ | 138 | ✅ | ✅ (publish authz, private→one only, all→2 targets, entitlement upsert, Alpha-only installs, audit) | backend-only; frontend wiring in 4.2b |
| 4.2b Package admin wiring | ✅ | ✅ | ✅ | 149 | ✅ | reuses 4.2a JWT suite | browser E2E deferred; publish via RPC service |
| 4.3A Leave persistence | ✅ | ✅ | ✅ | 146 | ✅ | ✅ (14 scenarios: entitlement/company-active/role/cross-tenant FK/transition/audit) | leave adapter lazy chunk (1.1 KB); main 475 KB; browser E2E deferred |
| Integration (4.2 + 4.3A) | ✅ | ✅ | ✅ | 158 | ✅ | ✅ leave 14/14 + package-release 10/10 on merged schema | combined verification; database.types regenerated; both suites saved under `supabase/tests/` |
| 5.1 Request Records | ✅ | ✅ | ✅ | 169 | ✅ | ✅ 10/10 (+ leave 14 + package 10 = 34) | request adapter lazy chunk (1.4 KB); main 475 KB; platform-plane RLS; browser E2E deferred |
| Combined (4.3B + 5.1) | ✅ | ✅ | ✅ | 182 | ✅ | ✅ package 10 · leave 14 · attendance 18 · requests 10 = 52 | attendance migration renumbered `090000→110000`; database.types regenerated; clean-mergeable Attendance PR |
| 5.2 Diagnostics & Release Gate | ✅ | ✅ | ✅ | 188 | ✅ | ✅ diagnostics 14 (incl. gate: FAIL blocks, PASS/WARN/advisory-FAIL allow) + 52 prior = 66 | diagnostic adapter lazy chunk (1.7 KB); main 476 KB |
| 5.3 Installation Recovery | ✅ | ✅ | ✅ | 194 | ✅ | ✅ recovery 12 (retry/rollback authz, entitlement sync, state trigger, audit) + 66 prior = 78 | recovery via existing packages adapter; main 476 KB |
| 5.4 Usage Analytics | ✅ | ✅ | ✅ | 197 | ✅ | ✅ usage 7 (audit-derived aggregation, self-gate, company filter, distinct companies) + 78 prior = 85 | usage adapter lazy chunk (0.4 KB); main 476 KB |
| 5.5 Audit & Health | ✅ | ✅ | ✅ | 201 | ✅ | ✅ audit/health 9 (enriched actor/company, self-gate, company filter, failed→degraded) + 85 prior = 94 | audit + health adapters lazy chunks; main 476 KB |
| 5.6 CI automation | ✅ | ✅ | ✅ | 201 | ✅ | hosted CI + local reset: 8 SQL/RLS suites (94 scenarios), typecheck, lint, tests, build | browser E2E and hosted deployment remain |
| Engineering quality hardening | N/A | ✅ | ✅ | 220 | ✅ | docs/state/session/version checks plus existing SQL baseline | hosted browser QA remains |

## Current risks
- Mock is default; Supabase HR-Core path verified at DB/RLS level, **not yet exercised end-to-end in the browser**.
- Role model is `company_admin` / `company_user` only — no `hr_manager`; spec HR-Manager rules map to `company_admin`.
- `feat/hr-core-persistence` is based on `feat/live-route-guards` (unmerged) — rebases when the guard PR lands.
- Mock create/update/disable/terminate are simulated (no persistence) — expected pattern.
- Hosted Supabase schema is deployed and migration history is aligned; the API-grants migration fixed authenticated REST access to RLS-protected tables. Hosted companies, memberships, and platform admins are still empty.
- Hosted Auth URL configuration, demo users/seed data, and final Vercel environment verification remain deployment checks. Confirm the production URL and environment scope before changing hosted settings.
- The deployment checklist names `usage_events` and `system_health_checks`, but this repository intentionally derives usage from `audit_logs` (`usage_metrics()`) and health from `system_health()`; those tables should not be added without a product/schema decision.
- **Fixed (4.1):** package gating previously read mock `company.packages`, which is `undefined` for real Supabase tenants (would have hidden Leave for everyone on the Supabase path). Gating now uses `enabledPackageCodes` from the membership context — one source for mock and Supabase, guard + nav aligned.
- Request Records are now persisted (platform-plane). Remaining mock-backed platform surfaces: diagnostics, installations monitor, usage, health — Phase 5.2–5.5.

### Technical debt (explicit, from 5.1)
- **`request_records.diagnostic_id`** is a nullable column with **no FK yet** — the diagnostics table arrives in 5.2, which will add the composite/plain FK and the "attach diagnostic to request/package version" flow. Until then the Request detail's Diagnostic link resolves against mock diagnostics.
- **Package linking on create is not persisted**: the Create Request form's extension-nature/company-target selector is validated but not written (`linked_package_key`/`linked_package_version` stay null). A dedicated "link package/version to request" action is deferred (no approved UI for it yet).
- **Platform-plane RLS**: `request_records` is Platform-Admin-only for every operation (internal notes, email refs). Companies do not see their own requests; add a company-facing read policy only if a customer-facing "my requests" view is introduced.
- **Request history** is captured via `audit_logs` (`request.*` events with from/to), not a dedicated timeline table/UI. A visible history panel is deferred.

### Technical debt (explicit, from 4.3A)
- **Role model** still `company_admin` / `company_user` only — no `hr_manager`. Leave **writes** (create/approve/reject/cancel) are scoped to `company_admin`; `company_user` has read-only leave. An `hr_manager` role (and finer leave permissions) is deferred, not silently assumed.
- **Employee self-service** (a `company_user` filing their *own* leave, tied to `employees.user_id`) is deferred: the identity→employee linkage is not yet reliable for the demo tenants. First implementation is admin-managed.
- **`leave_types` as a per-company table** (with its own same-company composite FK) is deferred. The current UI exposes only the fixed categories `annual|sick|unpaid`, so leave type is a Postgres enum — no speculative type-management surface. Revisit when leave-type CRUD is required.
  - **Upgrade path** (enum → tenant-configurable types, when a management UI + business need exist): add `leave_types(id, company_id, name, is_active, unique(company_id,name), unique(company_id,id))` with entitlement-backed RLS + per-tenant seeding; add nullable `leave_type_id uuid` to `leave_requests` with composite FK `(company_id, leave_type_id) → leave_types(company_id, id)`; backfill from the enum; move reads to the FK; retire the enum last. No data loss — the enum values become the initial seeded rows.
- **Status machine** intentionally minimal: `approved`/`rejected`/`cancelled` are terminal (no `approved → cancelled`). Central rule in `src/data/leave/transitions.ts` mirrors the DB trigger; widen both together if needed.

## Next actions
1. Configure the correct Vercel project with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_DATA_SOURCE=supabase`; configure hosted Auth redirect URLs.
2. Create the approved Platform Admin, Alpha, and Beta Auth users and matching database records, then prepare the production seed data.
3. Run hosted browser and tenant-isolation smoke under `VITE_DATA_SOURCE=supabase`, then complete monitoring hardening and custom-domain/wildcard-subdomain work.

### Manual browser smoke checklist — Installation recovery (run under `VITE_DATA_SOURCE=supabase`)
- [ ] Platform admin → Installation Monitoring lists installs; a failed row shows **Retry**, an installed row shows **Roll back**
- [ ] Retry a failed install → status `installed`; the company regains access to the package
- [ ] Roll back an installed package (confirm dialog) → status `rolled_back`; the company immediately loses access (guard + RLS)
- [ ] `installation.retried` / `installation.rolled_back` appear in audit with the real actor
- [ ] Non-platform user cannot retry/rollback (RPC `not_authorized`)

### Manual browser smoke checklist — Diagnostics & gate (run under `VITE_DATA_SOURCE=supabase`)
- [ ] Platform admin → open a diagnostic report → per-dimension checks render with PASS/WARN/FAIL + required/advisory
- [ ] Create Release: pick a PASS/WARN version → publish succeeds
- [ ] A version with a required FAIL check → Publish disabled + message; RPC also rejects if forced
- [ ] Non-platform user → diagnostics not readable (platform-plane RLS)

### Manual browser smoke checklist — Requests (run under `VITE_DATA_SOURCE=supabase`)
- [ ] Platform admin login → Request Records lists persisted rows
- [ ] Create Request → row appears `received`; `request.created` in audit
- [ ] Advance status (received → under_review → approved …) → dropdown offers only valid next states; `request.status_changed` in audit
- [ ] Attempt an illegal jump → rejected (guard + DB)
- [ ] Non-platform user → Requests not readable/writable (platform-plane RLS)

### Manual browser smoke checklist — Leave (run under `VITE_DATA_SOURCE=supabase`)
- [ ] Alpha `company_admin` login → Leave page lists persisted requests
- [ ] Add Request (employee/type/dates) → row appears `pending`; `leave.requested` in audit
- [ ] Approve → status `approved`, reviewer = signed-in admin; `leave.approved` in audit
- [ ] Reject / Cancel a pending request → correct terminal state + audit event
- [ ] Alpha `company_user` → Leave visible, decision buttons/insert denied (RLS)
- [ ] Beta user (no Leave package) → route shows PackageUnavailable; any direct read/insert denied by RLS
- [ ] Cross-tenant: Alpha cannot see/act on Beta leave rows

## Decision log
- One codebase + one deployment (no per-customer branches).
- Supabase as the main backend; no NestJS initially.
- **RLS is the security boundary**; frontend checks are UX only.
- One manifest per distinct package; package **assignment** controls availability (not branches).
- Query-param tenant fallback now; wildcard subdomains later.
- Mock remains the default data source until the Supabase path is browser-verified.
- **The release gate is DB-authoritative**: `publish_package_release` refuses a version with any required FAIL check (`version_release_blocked`), and the publish UI mirrors it for fail-fast UX. Report result is derived from checks (FAIL>WARN>PASS) by trigger; `WARN` requires review but does not block; advisory (non-required) checks never block.
- Diagnostics are **platform-plane** (Platform-Admin-only), and a diagnostic links a **package version** to an optional **request** via `request_records.diagnostic_id`.
- **Recovery reconciles entitlements, not just install rows**: `rollback` disables `company_packages.enabled` (the tenant loses access via `can_use_company_package` immediately), and `retry` re-enables it. Both are Platform-Admin-only SECURITY DEFINER RPCs; direct client UPDATEs on `package_installations` remain blocked (no update policy) and the state-machine trigger guards every transition.
- **Usage analytics is derived from `audit_logs`, not a separate events table**: every action already writes an audit row, so `usage_metrics()` aggregates by action-prefix module (count + distinct companies). DRY and always in sync; a dedicated time-series/usage-events table is deferred until trend analysis is required.
- **Platform read surfaces that need cross-tenant or `auth.users` data go through SECURITY DEFINER functions, self-gated on `is_platform_admin()`** (`usage_metrics`, `platform_audit_log`, `system_health`) — the client never joins `auth.users` directly, and a non-admin caller simply receives an empty result. System health is **derived from real counts** (failed installations degrade the signal), not stored.
- **Platform-plane data** (package releases, request records) is Platform-Admin-only in RLS — distinct from tenant data (HR core, leave, attendance) which is company-scoped. The two planes never share a read policy.
- Request Records are the pipeline entry point; **diagnostics attach to a request/package version (5.2), so requests are persisted first** (`diagnostic_id` FK deferred to 5.2).
- Same-company relationships enforced by **composite foreign keys**, not just RLS/UI.
- The full package-access rule (active user ∧ active membership ∧ active company ∧ enabled+active package ∧ role ∧ matching company_id) is enforced in **both** RLS and the application service. `can_use_company_package()` is the DB-side composition; `PackageGuard` + service validation are the app-side mirror.
- Optional-package status machines have a single source of truth shared by DB trigger and service (`src/data/leave/transitions.ts`); the DB is authoritative, the client fails fast.
