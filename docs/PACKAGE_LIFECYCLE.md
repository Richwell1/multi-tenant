# Package Lifecycle & 30-Day Data Retention

This document describes the package lifecycle model: diagnostics gating, install/
update review, disable vs. uninstall, 30-day retention, restore, permanent
removal, and secure purge. It is being delivered in verified phases.

## Intended lifecycle

```
version created → diagnostics run → diagnostics PASS → published/assigned
→ company reviews impact → installs/updates → active
→ company may disable / update / roll back / uninstall
→ uninstall starts 30-day retention → restore or permanently remove
→ expired retained data is securely purged
```

## Identity & security model

- The **company UUID + active membership + RLS** remain the security boundary. A
  slug is only routing; a package key is only catalog identity.
- Every company lifecycle operation runs through a **SECURITY DEFINER RPC** that
  self-authorizes via `auth.uid()` → `public.require_company_admin()` (active
  `company_admin` of an active company). Pages/components never call Supabase
  directly, and the RPCs only ever act on the **caller's own** company — a tenant
  can never target another tenant's packages or data.
- The secure purge (`purge_expired_retention`) is **service-role only** — it is a
  trusted backend job (scheduled Edge Function), never callable from the browser.

## Diagnostics gating (already enforced)

A package version carries `package_versions.diagnostic_status` (`PASS`/`WARN`/
`FAIL`, derived from its `diagnostic_checks`). Installation resolves only the
latest **released + `PASS`** version; a `FAIL`/`WARN`/unreleased version is not
installable. Publishing is blocked while any required check is `FAIL`
(`version_release_blocked`). Each version also carries a structured
`impact_manifest jsonb` that drives the install/update/rollback review UI.

## Disable vs. Uninstall vs. Permanent removal

| | Entitlement | Nav/routes | Feature data | Reversible |
|---|---|---|---|---|
| **Disable** | off | hidden/blocked | preserved indefinitely (`data_state=active`) | re-enable |
| **Uninstall** | off | removed/blocked | **retained 30 days** (`data_state=retained`) | restore within window |
| **Permanent removal** | off | removed | package-owned data **deleted** (`data_state=purged`) | irreversible |

Uninstall never deletes feature data immediately — it sets
`retention_until = now() + 30 days`. Retained data is **not** exposed through
ordinary feature APIs (the entitlement is off, so `can_use_company_package` RLS
denies access); it returns only via an authoritative **restore**.

## Data model (migration `20260802010000`)

- `packages.is_mandatory` — mandatory system packages (HR Core) cannot be
  uninstalled or permanently removed by a company admin.
- `packages.feature_table` — the company-owned table purged on removal
  (`document-notes`→`document_notes`, etc.); `NULL` = no per-company data.
- `package_versions.impact_manifest jsonb` — structured frontend/backend/
  dependencies/migrations/rollback/retention impact per version.
- `company_packages` retention columns: `data_state` (`active` / `retained` /
  `restored` / `pending_purge` / `purged`), `uninstalled_at`, `retention_until`,
  `previous_installed_version`, `uninstall_reason`, `restored_at`,
  `permanently_deleted_at`.
- `package_lifecycle_operations` — one row per operation (install/update/rollback/
  disable/enable/uninstall/restore/permanent_removal/purge) with status,
  source/target version, diagnostics status, `correlation_id`, `initiated_by`,
  timings, and safe `failure_reason`. A **partial unique index** allows at most
  one `running` operation per company+package (concurrency guard).
- `package_restore_points` — entitlement-state snapshot captured before an
  uninstall/update/rollback (not a full feature-data copy — restore relies on
  preserved rows + migration compatibility).

## RPCs

`disable_package` · `enable_package` · `uninstall_package(reason)` ·
`restore_package` · `permanently_remove_package` (company, self-authorizing) and
`purge_expired_retention` (service-role). Purge is **idempotent**, isolates
failures per company+package (`for update skip locked`), and records **counts,
never content** in the audit log.

## Audit events

`package.disabled` · `package.enabled` · `package.uninstalled` ·
`package.restored` · `package.purge.completed` (with `trigger: manual|scheduled`
and `rows_deleted`). Raw action codes are stored; the UI maps them to labels.

## Verification (this phase)

`unique`/lifecycle SQL suite `package_lifecycle_rls.sql` (16 checks): mandatory
protection, disable≠uninstall, 30-day retention, data preserved on uninstall,
retained data hidden from normal access, restore-without-duplication,
permanent-removal deletes only package-owned data, cross-tenant isolation, audit
survival, idempotent purge, and PASS-only install. **20/20** SQL suites overall.

## Delivered in phases

- **Phase 1 (this branch, done & verified):** the lifecycle + retention database
  backbone — schema, RLS, RPCs, impact-manifest column, and the SQL suite above.
- **Phase 2 (this branch, done & verified):** TypeScript lifecycle layer —
  `src/data/package-lifecycle` (repository interface + stateful mock + Supabase
  RPC adapter), `useCompanyPackages` + disable/enable/uninstall/restore/
  permanently-remove hooks (scoped cache invalidation), and the Installed
  Packages panel: lifecycle-status cards with actions gated by category + role +
  state, an uninstall→retention confirm, and a typed-confirmation permanent
  removal. Tests: pure action-gating, mock transitions, and the panel UI.
- **Phase 3+ (planned):** TypeScript repository/hooks/services for the remaining
  RPCs; install/update/rollback **review dialogs**; Installed-Packages lifecycle
  actions (Disable/Enable/Uninstall/Restore/Permanently Remove) gated by category
  + role + state; Platform-Admin monitoring surface; a scheduled purge Edge
  Function; three new marketplace extensions, three system tools, and two private
  customizations (each with feature table + vertical + impact manifest +
  diagnostics); and the full frontend/service test matrix.

## Remaining limitations / deferred

- Update & rollback currently reuse the existing release/rollback RPCs; the
  dedicated review-gated update/rollback transactions and restore-point wiring
  land with Phase 2.
- `verify:package-security` is referenced by the spec but not yet a script in
  this repo.
- Slug rename and scheduled purge cron remain deferred (purge is manually
  invokable and scheduler-ready).
