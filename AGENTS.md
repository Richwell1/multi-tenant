# Muttitenants HR Agent Instructions

Read these files before making changes:

- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/OVERVIEW.md

Use the Google Stitch MCP project named Muttiteneats HR as the visual source of truth.

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