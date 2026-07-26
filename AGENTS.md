# Multi-Tenants HR Agent Instructions

Read these files before making changes:

- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/OVERVIEW.md

Use the Google Stitch project as the visual source of truth for Multi-Tenants HR.

## Product scope

This is a lightweight multi-tenant HR ERP demonstration.

The demo must prove:

- Company self-registration
- Email and password login
- Unique company subdomains
- Tenant data isolation
- Role-based access
- Automatic HR Core assignment
- Private packages for one company
- Standard updates for all companies
- Lightweight package diagnostics
- Basic usage and health analytics

## HR Core

Every company automatically receives only:

- Employees
- Departments
- Positions

Leave Management and Attendance Management are optional packages.

## Demonstration companies

Alpha Trading:

- HR Core
- Leave Management

Beta Manufacturing:

- HR Core only

Beta must not see or access Leave Management.

Attendance Management will later be targeted to all companies.

## Restrictions

Do not add:

- MFA
- OTP
- Forgot password
- Password reset
- Invitation onboarding
- In-app chat
- Company request submission
- Payroll
- Recruitment
- Performance management
- Billing
- Microservices
- Kubernetes
- Advanced incident management

## Architecture rules

- One repository
- One shared application
- One Supabase backend
- Tenant-owned tables contain company_id
- Frontend hiding is not sufficient for security
- Supabase Row-Level Security must enforce isolation
- Package access must be checked by the backend
- Keep route components small
- Use services and repositories
- Preserve the Kinetic Enterprise design system

## Engineering quality rules

- Keep the supported roles limited to `platform_super_admin`, `company_admin`,
  and `company_user` unless the product scope is deliberately changed.
- Use real `company_id` UUIDs in Supabase mode; slugs are for resolution and
  display only.
- Treat Supabase RLS, grants/Data API exposure, and server-side entitlement
  checks as separate security boundaries. Do not change them without a
  reproduced failure and a focused test.
- Treat zero-row results as valid data where the product allows an empty list;
  do not use `.single()` for list or optional queries.
- Keep optional dashboard queries independently recoverable when practical;
  session and authorization failures may remain page-blocking.
- Route all user-facing mutation feedback through the central notification
  utility and invalidate tenant-scoped query keys after writes.
- Destructive actions require confirmation, keyboard-accessible focus handling,
  and visible retry/error states.
- The platform version comes from `package.json` through
  `src/lib/app-version.ts`; package release versions are a separate domain
  concept.
- Add comments only for non-obvious business, security, state-machine, cache,
  session, accessibility, versioning, or intentional technical-debt decisions.
