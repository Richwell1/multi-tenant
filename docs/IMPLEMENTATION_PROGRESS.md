# Implementation Progress — Multi-Tenants HR

> Single operational progress tracker. Keep concise; do not duplicate README/ARCHITECTURE.
> Update after every successful increment.

## Project summary

| | |
|---|---|
| Product | Multi-Tenants HR |
| Current branch | `feat/package-entitlements` |
| Current phase | Phase 4 — Package system (4.1 entitlements + route-level guard complete) |
| Current increment | 4.1 — Package entitlements + route-level guard (complete) |
| Default data source | `mock` (`VITE_DATA_SOURCE`), Supabase path behind lazy adapters |
| Local Supabase ports | API/Functions 54331 · DB 54332 · Studio 54333 (project-local +10 offset) |
| Hosted Supabase | Linked (`uezvaqoqqqgblpcbkujq`); **no migrations pushed** |
| Test count | 137 |

## Phase tracker

| Phase | Increment | Status | Completed | Branch | Commit | Verification | Remaining risks |
|---|---|---|---|---|---|---|---|
| 1 | Supabase foundation + tenancy schema | Complete | 2026-07-25 | (merged into 5024176) | — | reset/RLS/types ✅ | — |
| 2 | Auth boundary + atomic onboarding | Complete | 2026-07-25 | main | `5024176` | Edge+SQL ✅ | hosted email-confirm flow |
| 2.5 | Live route guards + membership resolution | Complete | 2026-07-25 | feat/live-route-guards | `f490c95` | 114 tests ✅ | not merged to main |
| 3A | Departments | Complete | 2026-07-25 | feat/hr-core-persistence | `59b7276` | 119 tests + JWT RLS ✅ | mock simulated writes |
| 3B | Positions | Complete | 2026-07-25 | feat/hr-core-persistence | `f6674b9` | 126 tests + JWT RLS+FK ✅ | mock simulated writes |
| 3C | Employees | Complete | 2026-07-25 | feat/hr-core-persistence | `b0bb3f6` | 134 tests + JWT RLS (dual FK, uniqueness, terminate audit) ✅ | browser E2E deferred |
| 4 | Package & extension system | In progress | — | feat/package-entitlements | `69eae2e` | 4.1 ✅ (136 tests + JWT RLS) | defs/versions/assignments UI + Leave/Attendance persistence remain |
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
- [ ] Package definitions / versions / assignments UI
- [ ] Leave / Attendance persistence

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

## Current risks
- Mock is default; Supabase HR-Core path verified at DB/RLS level, **not yet exercised end-to-end in the browser**.
- Role model is `company_admin` / `company_user` only — no `hr_manager`; spec HR-Manager rules map to `company_admin`.
- `feat/hr-core-persistence` is based on `feat/live-route-guards` (unmerged) — rebases when the guard PR lands.
- Mock create/update/disable/terminate are simulated (no persistence) — expected pattern.
- Hosted Supabase migrations not pushed; no deployment yet.
- **Fixed (4.1):** package gating previously read mock `company.packages`, which is `undefined` for real Supabase tenants (would have hidden Leave for everyone on the Supabase path). Gating now uses `enabledPackageCodes` from the membership context — one source for mock and Supabase, guard + nav aligned.
- Leave/Attendance data still read from the mock repository (persistence is a later Phase 4 increment); only the entitlement gate is unified now.

## Next actions
1. **Browser E2E smoke** under `VITE_DATA_SOURCE=supabase` with seeded users (login → departments → positions → employees → add → terminate → Alpha/Beta isolation). Blocks making Supabase the default.
2. Phase 4 next: package definitions + versions + company assignment/release-targeting **write** flows (persist `company_packages` via a repository/service; wire Admin package screens); then Leave/Attendance persistence behind the now-real entitlement gate.
3. Merge `feat/live-route-guards` → `feat/hr-core-persistence` → `feat/package-entitlements` into `main` in order.
4. Automate JWT/RLS integration tests in CI (currently run manually via psql).
5. Plan hosted rollout (push migrations, deploy Edge Functions, Vercel).

## Decision log
- One codebase + one deployment (no per-customer branches).
- Supabase as the main backend; no NestJS initially.
- **RLS is the security boundary**; frontend checks are UX only.
- One manifest per distinct package; package **assignment** controls availability (not branches).
- Query-param tenant fallback now; wildcard subdomains later.
- Mock remains the default data source until the Supabase path is browser-verified.
- Same-company relationships enforced by **composite foreign keys**, not just RLS/UI.
