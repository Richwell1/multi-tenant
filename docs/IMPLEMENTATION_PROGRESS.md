# Implementation Progress — Multi-Tenants HR

> Single operational progress tracker. Keep concise; do not duplicate README/ARCHITECTURE.
> Update after every successful increment.

## Project summary

| | |
|---|---|
| Product | Multi-Tenants HR |
| Current branch | `feat/attendance-management-persistence` (from merged `main`) |
| Current phase | Phase 4 — Package system (4.2 + 4.3A merged; 4.3B Attendance persistence complete) |
| Current increment | 4.3B — Attendance Management persistence |
| Default data source | `mock` (`VITE_DATA_SOURCE`), Supabase path behind lazy adapters |
| Local Supabase ports | API/Functions 54331 · DB 54332 · Studio 54333 (project-local +10 offset) |
| Hosted Supabase | Linked (`uezvaqoqqqgblpcbkujq`); **no migrations pushed** |
| Test count | 171 |

> 4.2 (package-release) + 4.3A (leave) were merged to `main` via PR #7. 4.3B
> branches from that merged `main` (9 migrations). RLS suites now live under
> `supabase/tests/`: `package_release_rls.sql` (10), `leave_rls.sql` (14),
> `attendance_rls.sql` (18) — 42 scenarios, all green on a single reset.

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
| 4.3A | Leave Management persistence | Complete | 2026-07-25 | feat/leave-management-persistence | `554e9d0` | merged (PR #7); 14 JWT/RLS ✅ | writes scoped to company_admin; self-service + leave_types table deferred |
| 4.3B | Attendance Management persistence | Complete | 2026-07-25 | feat/attendance-management-persistence | (this branch) | 171 tests + 18 JWT/RLS ✅ | writes scoped to company_admin; self-check-in deferred; single-session/day |
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
- [x] Release schema (package_releases / targets / installations) + atomic `publish_package_release` RPC (Platform-Admin-only, DB-enforced classification→target rules)
- [x] Package repositories/services (mock + lazy Supabase; publish via RPC) + Admin UI wiring (Create Release, Package Details, Installation Monitoring, Company assignments)
- [x] Leave persistence (entitlement-gated + RLS + status machine + audit)
- [x] Attendance persistence (entitlement-gated + RLS + check-in/out machine + audit)

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

### Attendance Management (4.3B)
- [x] `attendance_records` table; same-company composite FK `(company_id, employee_id)→employees`
- [x] `unique(company_id, employee_id, attendance_date)` — one row per employee per day
- [x] Entitlement-backed RLS via `can_use_company_package(company_id, 'attendance-management')` (read: entitled member; write: entitled + `company_admin`); **Platform Admin deliberately excluded** from tenant attendance reads
- [x] Check-in/check-out state machine (`not_checked_in → checked_in → checked_out`, terminal) enforced in DB trigger **and** service; `check_out_time ≥ check_in_time` CHECK; no re-check-out
- [x] Server-side `updated_by` stamping from `auth.uid()`; `attendance.{created,checked_in,checked_out,updated}` audit events
- [x] Repositories (stateful mock + lazy Supabase) + service + hooks; Attendance UI wired (Add + Check-out)
- [x] 18 JWT/RLS scenarios (`supabase/tests/attendance_rls.sql`) + unit tests
- [ ] Employee self-check-in (company_user) — deferred (identity linkage)
- [ ] Multiple sessions per day — not modelled (UI shows one row/day); revisit if the UI adds it

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
| 4.3B Attendance persistence | ✅ | ✅ | ✅ | 171 | ✅ | ✅ 18/18 (+ leave 14 + package 10 = 42 on one reset) | attendance adapter lazy chunk (1.3 KB); main 475 KB; browser E2E deferred |

## Current risks
- Mock is default; Supabase HR-Core path verified at DB/RLS level, **not yet exercised end-to-end in the browser**.
- Role model is `company_admin` / `company_user` only — no `hr_manager`; spec HR-Manager rules map to `company_admin`.
- `feat/hr-core-persistence` is based on `feat/live-route-guards` (unmerged) — rebases when the guard PR lands.
- Mock create/update/disable/terminate are simulated (no persistence) — expected pattern.
- Hosted Supabase migrations not pushed; no deployment yet.
- **Fixed (4.1):** package gating previously read mock `company.packages`, which is `undefined` for real Supabase tenants (would have hidden Leave for everyone on the Supabase path). Gating now uses `enabledPackageCodes` from the membership context — one source for mock and Supabase, guard + nav aligned.
- Both optional packages (Leave, Attendance) are now persisted end-to-end behind the shared entitlement gate; no HR module still reads from the mock repository on the Supabase path.

### Technical debt (explicit, from 4.3A / 4.3B)
- **Role model** still `company_admin` / `company_user` only — no `hr_manager`. Leave **writes** (create/approve/reject/cancel) are scoped to `company_admin`; `company_user` has read-only leave. An `hr_manager` role (and finer leave permissions) is deferred, not silently assumed.
- **Employee self-service** (a `company_user` filing their *own* leave, tied to `employees.user_id`) is deferred: the identity→employee linkage is not yet reliable for the demo tenants. First implementation is admin-managed.
- **`leave_types` as a per-company table** (with its own same-company composite FK) is deferred. The current UI exposes only the fixed categories `annual|sick|unpaid`, so leave type is a Postgres enum — no speculative type-management surface. Revisit when leave-type CRUD is required.
  - **Upgrade path** (enum → tenant-configurable types, when a management UI + business need exist): add `leave_types(id, company_id, name, is_active, unique(company_id,name), unique(company_id,id))` with entitlement-backed RLS + per-tenant seeding; add nullable `leave_type_id uuid` to `leave_requests` with composite FK `(company_id, leave_type_id) → leave_types(company_id, id)`; backfill from the enum; move reads to the FK; retire the enum last. No data loss — the enum values become the initial seeded rows.
- **Status machine** intentionally minimal: `approved`/`rejected`/`cancelled` are terminal (no `approved → cancelled`). Central rule in `src/data/leave/transitions.ts` mirrors the DB trigger; widen both together if needed.

### Technical debt (explicit, from 4.3B)
- **Attendance writes** scoped to `company_admin`; `company_user` is read-only. Employee **self-check-in** deferred until reliable `auth.users → employees` linkage exists. `hr_manager` not introduced.
- **Platform Admin is deliberately excluded** from tenant attendance reads (unlike Leave/Employees, which allow platform-admin oversight). Attendance is operational HR data; the platform plane manages packages, not attendance. Revisit only if a product requirement for cross-tenant attendance oversight appears.
- **One attendance row per employee per day** (unique constraint); multiple sessions/day are not modelled because the UI shows a single row/day. Times are **time-of-day** (`time`) under a same-day assumption (`check_out_time ≥ check_in_time`); overnight spans are out of scope.

## Next actions
1. **Merge `feat/attendance-management-persistence` to `main`** (branches off the merged main; conflicts limited to additive `query-keys.ts`/`invalidation.ts` and regenerated `database.types.ts`).
2. **Browser E2E smoke** under `VITE_DATA_SOURCE=supabase` — package publish flow, Leave, **and** Attendance (login Alpha admin → add attendance → check out → confirm audit; Beta blocked by guard + RLS; Alpha `company_user` read-only). Deferred (interactive Supabase auth not scriptable here) — checklists below. Blocks making Supabase the default.
3. **Phase 5 — Requests / diagnostics / usage / audit** surfaces persisted end-to-end (the last major mock-backed area).
4. Automate the JWT/RLS suites in CI (`supabase/tests/*.sql` — 42 scenarios; currently run via `docker exec psql`).
5. Plan hosted rollout (push migrations, deploy Edge Functions, Vercel).

### Manual browser smoke checklist — Attendance (run under `VITE_DATA_SOURCE=supabase`)
- [ ] Alpha `company_admin` login → Attendance lists persisted rows
- [ ] Add Attendance (employee/date/status/check-in) → row appears; `attendance.checked_in` in audit
- [ ] Check out a checked-in row → check-out time + total hours; `attendance.checked_out` in audit
- [ ] Duplicate same-employee/day add → rejected (conflict)
- [ ] Alpha `company_user` → Attendance visible, Add/Check-out denied (RLS)
- [ ] Beta user (no Attendance package) → route shows PackageUnavailable; direct read/insert denied by RLS

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
- Optional-package status machines have a single source of truth shared by DB trigger and service (`src/data/leave/transitions.ts`, `src/data/attendance/transitions.ts`); the DB is authoritative, the client fails fast.
- Attendance times are modelled as **time-of-day** (`time`), not full timestamps, to match the approved UI (`HH:MM`); total hours are derived, never stored. Platform Admin is scoped **out** of tenant attendance reads by design.
