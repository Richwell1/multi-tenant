# Implementation Progress — Multi-Tenants HR

> Single operational progress tracker. Keep concise; do not duplicate README/ARCHITECTURE.
> Update after every successful increment.

## Project summary

| | |
|---|---|
| Product | Multi-Tenants HR |
| Current branch | `feat/leave-management-persistence` (from `main`) |
| Current phase | Phase 4 — Package system (4.3A Leave Management persistence complete) |
| Current increment | 4.3A — Leave Management persistence (complete) |
| Default data source | `mock` (`VITE_DATA_SOURCE`), Supabase path behind lazy adapters |
| Local Supabase ports | API/Functions 54331 · DB 54332 · Studio 54333 (project-local +10 offset) |
| Hosted Supabase | Linked (`uezvaqoqqqgblpcbkujq`); **no migrations pushed** |
| Test count | 146 |

> Note: 4.2 (package release-management backend/UI) lives on the separate,
> unmerged `feat/package-release-management` branch. 4.3A branches from `main`
> because Leave persistence depends only on Employees (3C), `company_has_package`
> (Phase 1) and `PackageGuard` (4.1) — all merged — not on 4.2.

## Phase tracker

| Phase | Increment | Status | Completed | Branch | Commit | Verification | Remaining risks |
|---|---|---|---|---|---|---|---|
| 1 | Supabase foundation + tenancy schema | Complete | 2026-07-25 | (merged into 5024176) | — | reset/RLS/types ✅ | — |
| 2 | Auth boundary + atomic onboarding | Complete | 2026-07-25 | main | `5024176` | Edge+SQL ✅ | hosted email-confirm flow |
| 2.5 | Live route guards + membership resolution | Complete | 2026-07-25 | feat/live-route-guards | `f490c95` | 114 tests ✅ | not merged to main |
| 3A | Departments | Complete | 2026-07-25 | feat/hr-core-persistence | `59b7276` | 119 tests + JWT RLS ✅ | mock simulated writes |
| 3B | Positions | Complete | 2026-07-25 | feat/hr-core-persistence | `f6674b9` | 126 tests + JWT RLS+FK ✅ | mock simulated writes |
| 3C | Employees | Complete | 2026-07-25 | feat/hr-core-persistence | `b0bb3f6` | 134 tests + JWT RLS (dual FK, uniqueness, terminate audit) ✅ | browser E2E deferred |
| 4 | Package & extension system | In progress | — | feat/package-entitlements | `69eae2e` | 4.1 ✅ (136 tests + JWT RLS) | defs/versions/assignments UI + Attendance persistence remain |
| 4.3A | Leave Management persistence | Complete | 2026-07-25 | feat/leave-management-persistence | (this branch) | 146 tests + 14 JWT/RLS ✅ | writes scoped to company_admin; self-service + leave_types table deferred |
| UI | UI/UX polish | In progress | 2026-07-25 | feat/ui-ux-polish | see `git log` | audit + shared foundation + dialog test + 137 tests ✅ | browser visual QA; push pending GitHub authentication |
| 5 | Requests / diagnostics / usage / audit | Not started | — | — | — | — | — |
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
- [ ] Package definitions / versions / assignments UI (on `feat/package-release-management`)
- [x] Leave persistence (entitlement-gated + RLS + status machine + audit)
- [ ] Attendance persistence

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

## Verification history

| Increment | db reset | typecheck | lint | tests | build | RLS/JWT | notes |
|---|---|---|---|---|---|---|---|
| 3A Departments | ✅ | ✅ | ✅ | 119 | ✅ | ✅ | dept adapter lazy chunk |
| 3B Positions | ✅ | ✅ | ✅ | 126 | ✅ | ✅ (+composite FK) | position adapter lazy chunk |
| 3C Employees | ✅ | ✅ | ✅ | 134 | ✅ | ✅ (dual FK, per-company unique #/email, terminate audit) | employee adapter lazy chunk; browser E2E deferred |
| 4.1 Package entitlements + guard | ✅ | ✅ | ✅ | 136 | ✅ | ✅ (company_packages entitlement isolation) | bundle unchanged (471 KB) |
| 4.3A Leave persistence | ✅ | ✅ | ✅ | 146 | ✅ | ✅ (14 scenarios: entitlement/company-active/role/cross-tenant FK/transition/audit) | leave adapter lazy chunk (1.1 KB); main 475 KB; browser E2E deferred |

## Current risks
- Mock is default; Supabase HR-Core path verified at DB/RLS level, **not yet exercised end-to-end in the browser**.
- Role model is `company_admin` / `company_user` only — no `hr_manager`; spec HR-Manager rules map to `company_admin`.
- `feat/hr-core-persistence` is based on `feat/live-route-guards` (unmerged) — rebases when the guard PR lands.
- Mock create/update/disable/terminate are simulated (no persistence) — expected pattern.
- Hosted Supabase migrations not pushed; no deployment yet.
- **Fixed (4.1):** package gating previously read mock `company.packages`, which is `undefined` for real Supabase tenants (would have hidden Leave for everyone on the Supabase path). Gating now uses `enabledPackageCodes` from the membership context — one source for mock and Supabase, guard + nav aligned.
- **Attendance** data still reads from the mock repository (Leave is now persisted; Attendance persistence is a later increment). Only the entitlement gate is unified for it.

### Technical debt (explicit, from 4.3A)
- **Role model** still `company_admin` / `company_user` only — no `hr_manager`. Leave **writes** (create/approve/reject/cancel) are scoped to `company_admin`; `company_user` has read-only leave. An `hr_manager` role (and finer leave permissions) is deferred, not silently assumed.
- **Employee self-service** (a `company_user` filing their *own* leave, tied to `employees.user_id`) is deferred: the identity→employee linkage is not yet reliable for the demo tenants. First implementation is admin-managed.
- **`leave_types` as a per-company table** (with its own same-company composite FK) is deferred. The current UI exposes only the fixed categories `annual|sick|unpaid`, so leave type is a Postgres enum — no speculative type-management surface. Revisit when leave-type CRUD is required.
- **Status machine** intentionally minimal: `approved`/`rejected`/`cancelled` are terminal (no `approved → cancelled`). Central rule in `src/data/leave/transitions.ts` mirrors the DB trigger; widen both together if needed.

## Next actions
1. **Browser E2E smoke** under `VITE_DATA_SOURCE=supabase` with seeded users — now including Leave: login (Alpha admin) → open Leave → add request → approve/reject/cancel → confirm audit; Beta (no package) blocked by guard **and** RLS; Alpha `company_user` read-only. Deferred (interactive Supabase auth not scriptable here) — see manual checklist below. Blocks making Supabase the default.
2. Merge order into `main`: `feat/package-release-management` (4.2) and `feat/leave-management-persistence` (4.3A) are independent off `main`; both add to `query-keys.ts`/`invalidation.ts` (additive — resolve trivially if both land).
3. Attendance persistence (mirror Leave: same entitlement gate + status/hours + RLS + audit).
4. Automate JWT/RLS integration tests in CI (`supabase/tests/*.sql`; currently run manually via `docker exec psql`).
5. Plan hosted rollout (push migrations, deploy Edge Functions, Vercel).

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
- Same-company relationships enforced by **composite foreign keys**, not just RLS/UI.
- The full package-access rule (active user ∧ active membership ∧ active company ∧ enabled+active package ∧ role ∧ matching company_id) is enforced in **both** RLS and the application service. `can_use_company_package()` is the DB-side composition; `PackageGuard` + service validation are the app-side mirror.
- Optional-package status machines have a single source of truth shared by DB trigger and service (`src/data/leave/transitions.ts`); the DB is authoritative, the client fails fast.
