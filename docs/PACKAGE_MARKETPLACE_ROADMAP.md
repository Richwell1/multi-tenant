# Package Model & Marketplace — Post-Demo Roadmap

> **Status:** design, not built. Deferred until after the presentation. Nothing
> here is on the demo path; the shipped demo model (three workflows) stays as-is.
> This document is the plan for the richer package model.

## Why

The demo model separates mandatory platform updates, admin-only private
customizations, and private extensions — but every package is still
**admin-installed**. The next model adds **company self-service** through a
marketplace while preserving Platform-Admin control, tenant isolation, one
codebase, and dynamic company onboarding. It also makes package **ownership and
distribution** explicit (who installs, who sees it, how updates roll out).

## What already exists (do not rebuild)

Three of the four target categories already ship and already obey the
dynamic-company rule (entitlements keyed by `company_id`/`package_key`, no names
or slugs anywhere):

| Target category | Ships today as |
|---|---|
| Standard package (mandatory, all-company auto) | `standard_update` + transactional all-company release + auto HR Core at registration |
| Private standalone (one company, admin-only) | `private_customization` |
| Private extension (one company, base-dependent, admin-only) | `private_extension` (`packages.base_package_key` + base-enabled release gate) |

Current schema (relevant): `packages(key, name, type, is_active, base_package_key)`,
`package_versions(diagnostic_status, released_at, …)`,
`company_packages(company_id, package_key, package_version, enabled, status)`,
`package_releases`, `package_installations`. RPCs: `create_package_with_version`,
`create_package_release` (transactional auto-install), `process_package_installation`,
`retry/rollback_package_installation`, `onboard_company` (latest released+PASS HR Core).

**The genuinely new pillar is the marketplace_extension category + company
self-install + update policies + adoption analytics + two new UI surfaces.**

## Category model (two axes — keep them separate)

The current `package_type` enum conflates *distribution/ownership* with *kind of
change*. Split them:

1. **`packages.category`** (distribution/ownership) — the primary axis:
   - `standard_package` — mandatory, platform-installed, all active companies
   - `marketplace_extension` — optional, company-installable, discoverable
   - `private_standalone` — one company, admin-only, hidden
   - `private_extension` — one company, base-dependent, admin-only, hidden
2. **`package_type`** (kind of change) — kept for release semantics only:
   `standard_update`, `bug_fix`, `security_update`, `configuration_update`.

**Do not rename existing enum values.** Map on introduction:
`standard_update`-typed packages → `standard_package`; `private_customization` →
`private_standalone`; `private_extension` → `private_extension` (already exists).
Add `standard_package` and `marketplace_extension` as new `category` values in
their own migration (enum-add must commit before use — same split pattern used in
`20260727010000`).

**Visibility is derived from category** (marketplace_extension = discoverable;
all others = hidden) to avoid a drifting second source of truth. If a future need
appears for hiding a marketplace item, add an explicit `visibility` column then —
not now.

## Schema deltas

```text
packages
  + category            package_category  not null   -- backfilled from type
  (base_package_key already exists; used by private_extension)

package_releases
  + update_policy       update_policy  not null default 'platform_managed'
                        -- 'platform_managed' = required/auto for adopters
                        -- 'company_managed'   = optional; company chooses when

company_packages
  + installation_source install_source  not null default 'platform_push'
  + installed_version   (already modeled by package_version; keep the name it has)
```

Enums to add (each in its own migration ahead of first use):

```text
package_category : standard_package | marketplace_extension | private_standalone | private_extension
update_policy    : platform_managed | company_managed
install_source   : platform_push | company_marketplace | private_assignment | registration_default
```

`installation_source` tells the Admin **how** each package reached each company.
Backfill on migration: `hr-core` from onboarding → `registration_default`;
existing all-company/standard releases → `platform_push`; private assignments →
`private_assignment`.

## RPCs (all SECURITY DEFINER, self-authorizing, dynamic company IDs)

### Company self-install (the core new capability)
`install_marketplace_extension(p_package_key text)` — caller-driven. Enforces the
full gate server-side, so a company cannot install an arbitrary package by
crafting a request:

```text
require: is_company_admin(caller's active company)
require: package.is_active
require: package.category = 'marketplace_extension'           -- private blocked even with a known key
require: latest version is released + diagnostic_status = 'PASS'
require: dependencies satisfied (base package enabled, if any)
then:    upsert company_packages(enabled=true, status='installed',
                                 installed_version = latest approved,
                                 installation_source = 'company_marketplace')
         create installation record + audit
```

Companion company RPCs: `update_installed_extension(p_package_key)` (company-managed
updates), `disable_installed_extension(p_package_key)` (self-disable a marketplace
extension — never a standard/private one).

### Admin-pushed updates
Extend release publishing with `update_policy`:
- `platform_managed` → auto-install the new version for **companies already using
  that extension** (not all companies) — required security/critical fixes.
- `company_managed` → mark an update available; companies see "Update available"
  and choose when.

Standard packages and private packages remain admin-installed as today.

### Adoption analytics (admin reads)
`extension_adoption()` / `package_adoption(p_package_key)` — aggregate
`company_packages` + `package_installations`: install count, distinct companies,
installed-version distribution, adoption % (installed latest ÷ installed any),
pending updates, failed/disabled installs. Platform-admin self-gated, like the
existing `usage_metrics` / `platform_audit_log` pattern.

## Security & RLS

- **Marketplace read:** authenticated company members may read `packages` where
  `category = 'marketplace_extension' and is_active` (catalog browse). Private and
  standard packages are not company-readable in the marketplace list.
- **No direct writes:** `company_packages` stays insert/update-blocked for
  companies; all installs go through the RPCs above (the gate lives in the RPC +
  RLS, never the UI).
- **Private isolation:** `private_standalone` / `private_extension` are never
  returned to a non-target company and cannot be installed company-side — the
  install RPC rejects any non-marketplace category.
- **Ownership:** private packages carry the target as a dynamic
  `owner_company_id uuid` (or continue via `package_releases`/`package_installations`
  targeting) — never a slug or name.

## Ownership matrix

| Category | Creator | Installer | In marketplace? | Target |
|---|---|---|---|---|
| Standard package | Platform Admin | Platform Admin (auto) | No | All active companies |
| Marketplace extension | Platform Admin | Company **or** Admin | Yes | Any eligible company |
| Private standalone | Platform Admin | Platform Admin only | No | One company |
| Private extension | Platform Admin | Platform Admin only | No | One company (needs base) |
| Security update | Platform Admin | Automatic | No | All affected companies |

## UI surfaces

**Company sidebar** (feature pages still gated on `packages.is_active AND company_packages.enabled`):
```text
Dashboard · Employees · Departments · Positions · Attendance · Leave
Extensions
  ├── Marketplace   (browse · description · version · dependencies · release notes · Install)
  ├── Installed     (installed extensions + versions + Disable + installation_source)
  └── Updates       (company-managed "Update available" + Update action)
Settings
```

**Admin Packages area:**
```text
Packages
  ├── Standard Packages
  ├── Marketplace Extensions
  ├── Private Packages
  ├── Private Extensions
  ├── Releases
  ├── Installations
  └── Adoption        (install counts · versions · adoption % · failures · manual vs auto)
```

## Naming (product clarity)

```text
Standard package         → mandatory platform capability
Marketplace extension    → optional reusable capability (many companies)
Private standalone       → unique independent feature (one company)
Private extension        → unique modification of an existing package
```
Do not call marketplace items "standalone" — reserve "standalone" for
one-company private packages.

## Phasing (each phase independently shippable + verified)

1. **Category + source columns** — add `packages.category`, `installation_source`;
   backfill; no behavior change. (Foundation; safe.)
2. **Marketplace read + browse UI** — company Marketplace list (read-only), admin
   Marketplace tab. No install yet.
3. **Company self-install RPC + Installed UI** — the security-gated install/disable
   path + `installation_source='company_marketplace'`.
4. **Update policy** — `update_policy` on releases; platform_managed auto-push to
   adopters; company_managed "Updates" tab.
5. **Adoption analytics** — admin Adoption views.

## Tests to add (per phase)

RLS/JWT: company can install only marketplace+approved; private hard-blocked
company-side even with a known key; non-target cannot read private; dependency
gate; platform_managed push hits only current adopters; company_managed does not
auto-install; adoption aggregates correct counts; `installation_source` recorded
per path; backfill correctness. Unit: category/visibility derivation, update-policy
UI states, marketplace gating in nav/guards.

## Non-negotiables carried forward

- One codebase, one deployment — no per-customer branches.
- RLS is the security boundary; UI checks are UX only.
- Every access derives from `company_id` + `package_key` entitlement records —
  never a company name or slug.
- DB RPC is the final authority for install/target/update rules.
