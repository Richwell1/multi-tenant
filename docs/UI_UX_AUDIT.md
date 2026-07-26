# Multi-Tenants HR UI/UX Audit

Audit date: 2026-07-25  
Scope: current frontend on `feat/package-entitlements`  
Visual reference: Kinetic Enterprise tokens already implemented in the repository. The named Google Stitch MCP project was not available in this session, so no new Stitch screens were imported.

## Summary

The application has a coherent foundation: shared shells, typed UI primitives, reusable state components, tenant-aware navigation, and responsive table overflow are already present. The main opportunities are consistency and interaction quality rather than new product behavior.

The highest-priority findings are:

- The two application shells do not provide a mobile navigation drawer, which makes the full route set difficult to reach below desktop widths.
- The shell controls and form controls need stronger focus visibility and state semantics.
- Field-level errors are announced but are not consistently linked to the input that caused them.
- The confirmation dialog closes on backdrop click but does not trap focus or restore focus to the trigger.
- Page headers and table toolbars become cramped on narrow screens.
- Auth screens need stronger context, grouping, and a more polished responsive composition.

## Findings by screen

Priority: Critical, High, Medium, Low.

| Screen | Route | Stitch reference | Visual issues | UX / responsive / accessibility issues | Duplicated UI | Current state | Priority / proposed improvement |
|---|---|---|---|---|---|---|---|
| Platform Admin login | `/login?portal=admin` | Kinetic admin auth | Compact card; limited platform context | Password toggle and errors need stronger focus/association; no registration is correct | Auth card pattern | Working | High — strengthen context, spacing, focus states |
| Company login | `/login?tenant=alpha` | Kinetic workspace auth | Same composition as admin with little tenant identity | Company context should be more prominent; mobile spacing is tight | Auth card pattern | Working | High — clarify tenant and company styling |
| Register Company | `/register` | Kinetic onboarding | Long single column with weak section grouping | Subdomain preview and password guidance need clearer hierarchy | Auth card / form fields | Working | High — group company and admin details; improve mobile flow |
| Access Denied | `/access-denied` | Kinetic message state | State is visually isolated | Back-to-login action is clear; heading context can be stronger | Shared message state | Working | Medium — improve state panel and action focus |
| Company Suspended | `/company-suspended` | Kinetic message state | Same as access denied | Needs clear workspace context | Shared message state | Working | Medium — improve state panel |
| Platform Dashboard | `/admin` | Kinetic admin dashboard | Good card basis; limited hierarchy between KPIs and activity | Toolbars and cards need consistent responsive spacing | Card/stat patterns | Working | High — improve KPI hierarchy and platform status grouping |
| Companies | `/admin/companies` | Kinetic admin table | Table is usable but toolbar is dense | Search and actions need mobile wrapping; row actions need clearer affordance | Table pattern | Working | High — responsive toolbar and row hierarchy |
| Company Details | `/admin/companies/:companyId` | Kinetic detail | Detail content is card-based but sparse | Company identity and package status could scan faster | Card/status patterns | Working | Medium — strengthen identity header and metadata layout |
| Request Records | `/admin/requests` | Kinetic admin table | Status and company context compete for attention | Filters/actions need clearer grouping | Table/status patterns | Working | High — improve status visibility and toolbar layout |
| Create Request | `/admin/requests/new` | Kinetic admin form | Form is functional but dense | Field errors and grouping need stronger semantics | Auth/form field patterns | Medium | Medium — reuse field layout and responsive form grid |
| Request Details | `/admin/requests/:requestId` | Kinetic detail | Notes and status controls need separation | Status change action needs clearer confirmation hierarchy | Card/form patterns | Working | Medium — improve sections and action hierarchy |
| Packages | `/admin/packages` | Kinetic release table | Classification and target data are text-heavy | Target summary should remain readable on narrow screens | Table/badge patterns | Working | High — badge and target hierarchy |
| Create Package Release | `/admin/packages/new` | Kinetic release form | Targeting form is dense | Selected chips and controls can overflow on mobile | Company target components | Working | High — improve grouping and wrapping without changing logic |
| Package Details | `/admin/packages/:packageId` | Kinetic detail | Release and diagnostic cards are similar weight | Publish/install actions need stronger visual order | Card/status patterns | Working | Medium — clarify release status and impact |
| Diagnostics | `/admin/diagnostics/:diagnosticId` | Kinetic diagnostic | Summary is readable but impact categories are flat | PASS/WARN/FAIL result should be more prominent and announced | Diagnostic/status patterns | Working | High — strengthen result hierarchy |
| Installations | `/admin/installations` | Kinetic operations table | Status is present but installation progress is visually quiet | Long package/company names need safe truncation | Table/status patterns | Working | Medium — improve status and timestamp scanability |
| Usage Analytics | `/admin/usage` | Kinetic analytics table | Data is table-first | No fake charts should be added; filters need structure | Table patterns | Working | Medium — improve table hierarchy and empty state |
| System Health | `/admin/health` | Kinetic health cards | Health cards are uniform | Healthy/degraded/offline states need consistent contrast and semantics | Card/status patterns | Working | Medium — strengthen status presentation |
| Audit Logs | `/admin/audit` | Kinetic audit table | Timestamp and action text are dense | Table needs predictable horizontal scrolling and readable metadata | Table patterns | Working | Medium — improve row spacing and wrapping |
| Workspace Dashboard | `/dashboard` | Kinetic workspace dashboard | Package status and KPIs are clear but light | Company identity should be stronger; cards need responsive reflow | Card/stat patterns | Working | High — improve workspace context and package summary |
| Employees | `/employees` | Kinetic workspace table | Search/action row is cramped | Toolbar stacks poorly; table requires clear mobile scroll affordance | Table/search patterns | Working | High — responsive toolbar and table hierarchy |
| Add Employee | `/employees/new` | Kinetic workspace form | Form is functional but fields are visually flat | Selects do not share the Input focus styling; errors are not linked | Form field patterns | Working | High — consistent controls and field semantics |
| Employee Profile | `/employees/:employeeId` | Kinetic detail | Profile is mostly KPI cards | Contact and metadata hierarchy is limited; danger zone is visually abrupt | Card/status patterns | Working | Medium — improve profile header and danger section |
| Departments | `/departments` | Kinetic workspace table | Inline add panel is useful but dense | Search/filter affordance is limited; disable action needs clearer placement | Table/form patterns | Working | Medium — consistent table and inline-form rhythm |
| Positions | `/positions` | Kinetic workspace table | Similar to Departments but not fully unified | Same responsive and control issues | Table/form patterns | Working | Medium — share visual language |
| Available Updates | `/updates` | Kinetic update flow | Wizard structure is present | Step semantics and impact emphasis can be clearer | Installation/state patterns | Working | High — strengthen step indicator and state announcements |
| Update Wizard | `/updates` | Kinetic update flow | Review/impact/confirm/install states exist | Progress and retry need more consistent visual hierarchy | Installation/state patterns | Working | High — polish state transitions without changing state machine |
| Installed Packages | `/packages` | Kinetic workspace table | Package status is readable | Long release notes/status need better wrapping | Table/badge patterns | Working | Medium — improve metadata density |
| Users & Roles | `/users` | Kinetic workspace table | Basic table is clear | Role/status should use shared badges and better row actions | Table/badge patterns | Working | Medium — improve identity and role scanability |
| Company Settings | `/settings` | Kinetic workspace form | Settings form is sparse | Read-only subdomain and save feedback need clearer treatment | Form/card patterns | Working | Medium — organize identity and editable settings |
| Leave | `/leave` | Kinetic optional package | Uses HR Core table language | Package context should be visible; actions need responsive layout | Table/status patterns | Gated / Alpha only | Medium — preserve package gate and polish shared layout |
| Attendance | `/attendance` | Kinetic optional package | Uses HR Core table language | Package context and action layout need the same treatment as Leave | Table/status patterns | Gated | Medium — preserve package gate and polish shared layout |

## Shared foundation findings

| Area | Finding | Priority | Proposed improvement |
|---|---|---:|---|
| Buttons | Primary/secondary/ghost/danger exist, but outline and icon-only affordances are not explicit; focus is inconsistent outside the Button primitive | High | Normalize variants, sizing, focus rings, and pending behavior |
| Form controls | Labels and errors exist, but `aria-describedby`/`aria-invalid` linkage is incomplete and native selects have a separate visual treatment | High | Add stable field ids, linked hints/errors, and shared control styling |
| Cards | Base card is consistent, but header/content spacing varies across pages | Medium | Establish calmer borders, subtle shadows, and responsive padding defaults |
| Tables | Horizontal overflow exists; headers and rows are visually light | High | Improve density, sticky-readable header treatment, focus/hover, and mobile toolbar behavior |
| Badges | Core tones exist but package classifications and role semantics are mostly expressed as plain text | Medium | Add explicit accessible tone aliases and stronger contrast |
| Page headers | Header action groups can overflow on narrow widths | High | Stack title/actions at mobile widths and add optional eyebrow/breadcrumb support |
| Dialogs | Escape and backdrop close work, but focus trap and return focus are missing | Critical | Add focus management and labeled description semantics |
| Navigation | Desktop collapse works; mobile navigation is unavailable | Critical | Add responsive drawer with accessible menu button and focusable close action |
| Motion | Existing transitions are subtle | Low | Add reduced-motion base rule and keep animation restrained |

## Deferred items

- Stitch-specific visual comparison and browser screenshots require the Stitch/visual inspection connector, which was not available in this session.
- Backend contract changes are intentionally deferred. This UI increment does not modify Supabase migrations, repositories, auth adapters, entitlement logic, query keys, or services.
- Full viewport browser smoke testing at 320/375/768/1024/1440 remains a follow-up if a browser runner becomes available; the implementation will include responsive CSS and component tests for the shared interaction changes.

## Engineering quality hardening addendum — 2026-07-26

The current hardening branch preserves the historical visual audit above and
adds the following cross-cutting improvements:

- Platform version `v0.1.0` is visible in the shared shell and public auth
  footer, sourced from `package.json` rather than duplicated text.
- Platform and company guards now distinguish a context/authorization query
  failure from an intentional access denial and provide a retry action.
- Confirm dialogs use unique accessible title/description IDs and stable focus
  handling while retaining Escape, backdrop, and focus-return behavior.
- Error and suspended state panels use alert semantics; ordinary loading/status
  panels remain status announcements.
- Session restoration cannot remain indefinitely in loading after an Auth
  failure, and logout clears local data even when remote sign-out fails.
- No backend, RLS, entitlement, package release, or migration behavior was
  changed by this hardening increment.

Full browser visual and keyboard QA remains pending at 320, 375, 768, 1024,
and 1440 pixels. It must be performed against the hosted URL before declaring
the visual audit fully closed.

## Final verification addendum — 2026-07-26

This audit remains historical where it records the original UI-polish branch;
the hardening follow-up is on `chore/engineering-quality-hardening` in commits
`688f949`, `15f4a56`, and `c4a3502`.

- Shared state semantics, retry behavior, empty data handling, notifications,
  dialog focus/pending behavior, session cleanup, and centralized versioning
  are implemented and covered by the 227-test application suite.
- Local Supabase was reset successfully and all 8 SQL/RLS suites passed,
  covering 94 scenarios. No RLS, grant, or migration change was required by
  this audit.
- Hosted schema and CI remain verified. Hosted Auth/demo-user setup, final
  Vercel environment confirmation, and hosted tenant-isolation smoke are still
  deployment checks.
- Manual visual and keyboard verification at 320, 375, 768, 1024, and 1440
  pixels is deferred because a browser runner was unavailable.
- The global platform version is `v0.1.0`, sourced once from `package.json`.
  Package releases remain independent and do not mutate that value. The custom
  domain is intentionally deferred.
