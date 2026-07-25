# Implementation Progress — Multi-Tenants HR

> Single operational progress tracker. Keep concise; do not duplicate README/ARCHITECTURE.
> Update after every successful increment.

## Project summary

| | |
|---|---|
| Product | Multi-Tenants HR |
| Current branch | `feat/request-records-persistence` (from merged `main`) |
| Current phase | Phase 5 — Platform Operations (5.1 Request Records persistence complete) |
| Current increment | 5.1 — Request Records persistence |
| Default data source | `mock` (`VITE_DATA_SOURCE`), Supabase path behind lazy adapters |
| Local Supabase ports | API/Functions 54331 · DB 54332 · Studio 54333 (project-local +10 offset) |
| Hosted Supabase | Linked (`uezvaqoqqqgblpcbkujq`); **no migrations pushed** |
| Test count | 169 |

> Branch topology: `main` = PR #7 (4.2 + 4.3A). Two feature branches sit off it in
> parallel and integrate independently — `feat/attendance-management-persistence`
> (4.3B, migration `090000`) and this one (5.1, migration `100000`). Numbers are
> disjoint so both merge cleanly. RLS suites under `supabase/tests/`:
> `package_release_rls.sql` (10), `leave_rls.sql` (14), `request_records_rls.sql`
> (10) — attendance's suite (18) rides its own branch.

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
| 4.3B | Attendance Management persistence | Complete | 2026-07-25 | feat/attendance-management-persistence | (parallel branch) | 171 tests + 18 JWT/RLS ✅ | not merged; parallel to 5.1 |
| UI | UI/UX polish | In progress | 2026-07-25 | feat/ui-ux-polish | see `git log` | audit + shared foundation + dialog test + 137 tests ✅ | browser visual QA; push pending GitHub authentication |
| 5.1 | Request Records persistence | Complete | 2026-07-25 | feat/request-records-persistence | (this branch) | 169 tests + 10 JWT/RLS ✅ | platform-admin-only; diagnostic FK deferred to 5.2 |
| 5.2–5.6 | Diagnostics / installations / usage / audit / CI | Not started | — | — | — | — | diagnostics attach to request/package version |
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
- [x] Attendance persistence (parallel branch `feat/attendance-management-persistence`)

### Platform Operations (Phase 5)
- [x] **5.1 Request Records** — `request_records` table; `request_priority` + `request_status` enums; platform-admin-only RLS (all ops); DB-enforced lifecycle (`request_status_can_transition`) mirrored in `src/data/requests/transitions.ts`; `request.{created,status_changed,updated}` audit; repositories (mock + lazy Supabase) + service + hooks; Admin UI rewired (status dropdown offers only valid next states); 10 JWT/RLS scenarios + unit tests
- [ ] 5.2 Diagnostics + release gate (attach to request/package version — adds the deferred `request_records.diagnostic_id` FK)
- [ ] 5.3 Installation monitoring + recovery
- [ ] 5.4 Usage analytics
- [ ] 5.5 Audit logs + system health surfaces
- [ ] 5.6 CI automation for the RLS/security suites

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
- [ ] Push migrations to hosted Supabase
- [ ] Deploy Edge Functions
- [ ] Vercel frontend deploy + env

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

## Current risks
- Mock is default; Supabase HR-Core path verified at DB/RLS level, **not yet exercised end-to-end in the browser**.
- Role model is `company_admin` / `company_user` only — no `hr_manager`; spec HR-Manager rules map to `company_admin`.
- `feat/hr-core-persistence` is based on `feat/live-route-guards` (unmerged) — rebases when the guard PR lands.
- Mock create/update/disable/terminate are simulated (no persistence) — expected pattern.
- Hosted Supabase migrations not pushed; no deployment yet.
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
1. **Merge the outstanding parallel branches to `main`**: `feat/attendance-management-persistence` (4.3B) and `feat/request-records-persistence` (5.1). Disjoint migrations (`090000` / `100000`); conflicts limited to additive `query-keys.ts`/`invalidation.ts` and regenerated `database.types.ts`.
2. **Phase 5.2 — Diagnostics + release gate**: diagnostics attach to a request and/or package version; adds the deferred `request_records.diagnostic_id` FK; gates release publishing on a passing diagnostic.
3. **Browser E2E smoke** under `VITE_DATA_SOURCE=supabase` — package publish, Leave, Attendance, **and** Requests (platform admin: create request → advance through the pipeline → confirm audit; illegal transition rejected; non-admin denied). Deferred (interactive Supabase auth not scriptable here). Blocks making Supabase the default.
4. Automate the JWT/RLS suites in CI (`supabase/tests/*.sql`; currently run via `docker exec psql`).
5. Plan hosted rollout (push migrations, deploy Edge Functions, Vercel).

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
- **Platform-plane data** (package releases, request records) is Platform-Admin-only in RLS — distinct from tenant data (HR core, leave, attendance) which is company-scoped. The two planes never share a read policy.
- Request Records are the pipeline entry point; **diagnostics attach to a request/package version (5.2), so requests are persisted first** (`diagnostic_id` FK deferred to 5.2).
- Same-company relationships enforced by **composite foreign keys**, not just RLS/UI.
- The full package-access rule (active user ∧ active membership ∧ active company ∧ enabled+active package ∧ role ∧ matching company_id) is enforced in **both** RLS and the application service. `can_use_company_package()` is the DB-side composition; `PackageGuard` + service validation are the app-side mirror.
- Optional-package status machines have a single source of truth shared by DB trigger and service (`src/data/leave/transitions.ts`); the DB is authoritative, the client fails fast.
