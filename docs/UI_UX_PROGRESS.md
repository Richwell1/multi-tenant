# UI/UX Progress — Multi-Tenants HR

Updated: 2026-07-25  
Branch: `feat/ui-ux-polish`

| Area | Status | Improvements | Verification / remaining |
|---|---|---|---|
| Audit | Complete | Added route-by-route findings and priorities in `docs/UI_UX_AUDIT.md` | Stitch MCP was unavailable; browser screenshots deferred |
| Extensions Marketplace | Complete | Subtitle "Optional standalone features your company can install"; cards show description, latest/installed version, and an Open action once installed; **per-card** install pending state (only the clicked card shows "Installing…" and is disabled) | `MarketplacePage` component test; hosted browser smoke pending |
| Feature-page errors | Complete | Create errors show inline once near the form (removed duplicate toast); form values preserved on failure; disabled + "Adding…" only while pending; access denied (not an editable form) via `PackageGuard` | Covered by hooks + `PackageGuard`; browser smoke pending |
| Shared buttons, badges, cards | Complete | Added outline/icon sizing, richer status tones, calmer borders/shadows, responsive padding | Typecheck/lint/tests/build pass |
| Forms and fields | Complete | Linked hints/errors with `aria-describedby`, clearer labels, shared select/textarea styling, autofill treatment | Full route form smoke test deferred |
| Tables | Complete | Improved row rhythm, focus-within state, responsive minimum width, consistent surface treatment | Browser viewport checks deferred |
| Platform shell | Complete | Responsive mobile drawer, overlay, Escape close, accessible menu/collapse labels, responsive top bar | Browser smoke deferred |
| Company shell | Complete | Same responsive shell with entitlement-driven navigation preserved | Alpha/Beta entitlement logic unchanged |
| Public/auth screens | Complete | Stronger portal context, onboarding grouping, password guidance, responsive card spacing, live error regions | Existing login/registration behavior preserved |
| Shared states/dialogs | Complete | Focus return, keyboard focus loop, dialog description semantics, reduced-motion base rule | ConfirmDialog focus behavior test added |
| Admin screens | In progress | Shared foundation and responsive search/header behavior applied across current routes | Page-specific visual pass remains for dense release/diagnostic flows |
| Workspace screens | In progress | Shared foundation and responsive employee search/header behavior applied across current routes | Page-specific visual pass remains for profile/settings/update details |
| Accessibility | In progress | Focus rings, labels, linked messages, dialog semantics, mobile menu labels | Full keyboard and contrast audit needs browser runner |
| Responsive QA | Deferred | Responsive CSS covers 320px+ layout patterns | Must smoke test 320/375/768/1024/1440 in browser |
| Performance | Complete | No dependencies or data-flow changes added; main JS 470.91 → 475.19 kB (+4.28 kB), gzip 143.70 → 144.83 kB (+1.13 kB) | No browser performance profile available |

## Deferred backend requirements

None introduced by this increment. Supabase adapters, RLS, entitlements, repositories, services, query keys, and mutation invalidation rules were not changed.

## Engineering quality hardening addendum — 2026-07-26

Branch: `chore/engineering-quality-hardening`

| Area | Status | Improvements | Verification / remaining |
|---|---|---|---|
| Application version | Complete | Shared `APP_VERSION` reads `package.json` and is shown in auth and both shells | 6 focused tests pass |
| Session lifecycle | Complete | Restore failures exit loading; logout clears local session/cache on remote failure | Typecheck/lint/tests/build pass |
| Guard states | Complete | Platform/company context failures show retryable errors instead of ambiguous denial | Route guard suite passes |
| Dialog accessibility | Complete | Stable focus lifecycle and unique title/description IDs | Shared state tests pass |
| State semantics | Complete | Error/suspended panels use `alert`; loading/status panels use `status` | Shared state tests pass |
| Documentation | Complete | README, architecture, PRD, overview, changelog, progress, and quality audit aligned | Browser-only claims remain deferred |
| Hosted visual QA | Deferred | No browser automation claim added | Manual checks still required |

## Final engineering-hardening verification — 2026-07-26

The historical UI polish record above is preserved. The follow-up hardening
branch is `chore/engineering-quality-hardening` with commits `688f949`,
`15f4a56`, and `c4a3502`.

| Area | Status | Evidence / remaining risk |
|---|---|---|
| Shared states | Complete | Loading, empty, success, error, warning, retry, and destructive states covered by shared tests and route audit |
| Notifications/dialogs | Complete | Central notification helpers and pending ConfirmDialog safeguards |
| Auth/session/cache isolation | Complete | Restore/logout/guard tests; hosted cross-account browser smoke pending |
| Application version | Complete | `APP_VERSION` reads `package.json`; `AppVersion` appears in auth and both shells |
| Responsive/keyboard behavior | Implemented | Manual 320/375/768/1024/1440 verification deferred without a browser runner |
| Local verification | Complete | Supabase reset, 8 SQL suites / 94 scenarios, typecheck, lint, 227 tests, and build pass |
| Hosted verification | Deferred | Hosted schema/CI verified; Auth/demo users, Vercel environment, and tenant-isolation smoke remain |

The UI polish bundle reference remains +4.28 kB main JavaScript and +1.13 kB
gzip. The current hardening build artifact is 484.88 kB main JavaScript and
147.23 kB gzip. Custom domain and wildcard-subdomain work remain deferred.
