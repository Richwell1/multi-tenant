# Architecture — Lightweight Multi-Tenant HR Package Demo

## 1. Architecture Goal

Build the smallest architecture that can prove:

- Company self-registration
- Email/password login
- Company subdomains
- Tenant-isolated data
- Role-based access
- Automatic HR Core assignment
- All-company package updates
- One-company private packages
- Simple package diagnostics

This is a demo architecture, not a full production ERP architecture.

## 2. Technology

- Frontend: React, TypeScript, Vite
- Backend: NestJS on Node.js
- Database: PostgreSQL
- ORM: Prisma or Drizzle
- Authentication: email/password with JWT or secure cookie sessions
- Deployment: one frontend, one API, one PostgreSQL database

No WebSocket infrastructure is required for the MVP. Update availability may refresh on login, page refresh, or a small polling interval.

## 3. High-Level Architecture

```text
/register and company subdomains
        |
        v
Shared React Application
        |
        v
Shared NestJS API
- Authentication
- Company registration
- Tenant resolution
- Roles and permissions
- HR Core
- Request records
- Packages and assignments
- Diagnostics
- Basic usage and health
        |
        v
PostgreSQL
- tenant_id isolation
- Row-Level Security
```

## 4. One Repository and One Deployment

Use:

- One repository
- Temporary feature branches
- One shared application deployment
- Database package assignments to control availability

Do not use:

- Repository per company
- Permanent branch per company
- Deployment per company

## 5. Minimal Backend Modules

```text
src/
  common/
    auth/
    tenancy/
    permissions/
    database/

  modules/
    registration/
    companies/
    users/
    roles/
    hr-core/
      employees/
      departments/
      positions/
    request-records/
    packages/
    diagnostics/
    usage-health/

  extensions/
    leave-management/
    attendance-management/
```

Do not add chat, invitation, email-delivery, password-reset, workflow-engine, billing, or incident-management modules.

## 6. Authentication

### Company registration

`POST /auth/register-company`

Creates in one transaction:

1. Company tenant
2. Company slug
3. First Company Admin user
4. Company membership
5. Default roles
6. HR Core assignment

### Login

`POST /auth/login`

Inputs:

- Email
- Password
- Tenant resolved from subdomain or selected registration context

### Logout

`POST /auth/logout`

The demo does not include:

- Password reset
- MFA
- Email verification
- Invitations
- Social login

A Platform Super Admin account may be seeded directly in the database.

## 7. Subdomain and Tenant Resolution

Example hosts:

```text
alpha-trading.exampleerp.com
beta-manufacturing.exampleerp.com
admin.exampleerp.com
```

Request flow:

1. Validate hostname.
2. Extract company slug.
3. Load active company.
4. Authenticate user.
5. Verify user membership in that company.
6. Create tenant context.
7. Load role and package assignments.

```ts
interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: 'company_admin' | 'company_user';
  enabledPackages: string[];
}
```

The Platform Super Admin portal uses a separate platform context and does not derive a company tenant from the URL.

## 8. Tenant Isolation

Every company-owned table contains:

```sql
tenant_id UUID NOT NULL
```

Use both:

- Tenant-scoped repository queries
- PostgreSQL Row-Level Security

Minimum tenant-owned tables:

- company_users
- employees
- departments
- positions
- company_packages
- package_installations
- usage_events

The backend must reject a request when the authenticated company does not match the company subdomain.

## 9. Roles and Permissions

Minimum roles:

```text
platform_super_admin
company_admin
company_user
```

Minimum permission groups:

```text
platform.companies.manage
platform.requests.manage
platform.packages.manage
platform.diagnostics.view
employees.manage
employees.view
departments.manage
positions.manage
packages.view
packages.activate
```

## 10. HR Core

HR Core is assigned automatically during company registration.

It includes:

- Employees
- Departments
- Positions

It does not include Leave or Attendance.

## 11. Package Model

### Code manifest

Each package has a version-controlled manifest:

```ts
interface PackageManifest {
  key: string;
  name: string;
  version: string;
  type: 'standard_update' | 'private_customization' | 'shared_extension' | 'bug_fix';
  dependencies: string[];
  affectedFrontend: string[];
  affectedBackend: string[];
  affectedTables: string[];
  permissions: string[];
  estimatedDataImpact: 'none' | 'create' | 'modify' | 'delete';
}
```

### Database assignment

```text
company_packages
- id
- company_id
- package_key
- package_version
- enabled
- status
- assigned_at
- activated_at
```

The manifest defines what the package contains. The assignment defines which company receives it.

## 12. Package Targeting

### All companies

Used for standard updates.

Example:

```text
Attendance Management 1.0.0
```

The backend creates assignments for every active company.

### One company

Used for private customization.

Example:

```text
Leave Management 1.0.0
Target: Alpha Trading
```

Only Alpha receives an assignment.

## 13. Request Records

Requests arrive by email outside the app.

The application stores only:

```text
request_records
- id
- company_id
- source_email_reference
- title
- request_type
- description
- priority
- status
- internal_note
- diagnostic_id
- linked_package_key
- created_at
- updated_at
```

No company request form, chat, messages, attachments, or email integration is required.

## 14. Lightweight Diagnostics

Diagnostics are manifest-based.

Inputs:

- Package manifest
- Target company
- Existing package assignments
- Seeded table counts

Outputs:

- Frontend impact
- Backend impact
- Database impact
- Permissions
- Dependencies
- Estimated data impact
- Compatibility
- PASS, WARN, or FAIL

For the demo:

- PASS permits publishing.
- WARN permits publishing after confirmation.
- FAIL disables publishing.

No source parser, shadow database, or real migration simulator is required.

## 15. Basic Usage and Health

Store simple usage events:

```ts
interface UsageEvent {
  tenantId: string;
  module: 'employees' | 'departments' | 'positions' | 'leave' | 'attendance';
  action: string;
  createdAt: Date;
}
```

The Platform Super Admin dashboard may show:

- Page/action counts per module
- Companies using each package
- Last active time
- API status
- Database status
- Seeded uptime percentage

Do not collect confidential HR values in analytics.

## 16. Minimal Database Tables

```text
platform_admins
companies
users
company_users
roles
user_roles
employees
departments
positions
packages
package_versions
company_packages
package_installations
request_records
diagnostic_reports
usage_events
```

## 17. Minimal Frontend Routes

### Public

```text
/login
/register
/access-denied
/company-suspended
```

### Platform

```text
/platform
/platform/companies
/platform/companies/:companyId
/platform/requests
/platform/requests/new
/platform/requests/:requestId
/platform/packages
/platform/packages/new
/platform/packages/:packageId
/platform/diagnostics/:diagnosticId
/platform/usage-health
```

### Company

```text
/dashboard
/employees
/employees/new
/employees/:employeeId
/departments
/positions
/updates
/packages
/users
/settings
```

Optional routes:

```text
/leave
/attendance
```

## 18. Demo Security Checks

Automated tests shall verify:

1. Alpha cannot read Beta employees.
2. Beta cannot read Alpha departments.
3. Beta cannot access Leave APIs when Leave is assigned only to Alpha.
4. Company users cannot access `/platform` routes.
5. HR Core is assigned automatically during registration.
6. Attendance assigned to all companies becomes available to Alpha and Beta.
7. A FAIL diagnostic prevents package publication.

## 19. Deployment

For the demo, deployment may use:

- Vercel or similar hosting for React
- Railway, Render, or similar hosting for NestJS
- Managed PostgreSQL
- Wildcard DNS or locally simulated subdomains

The demonstration may also use local hostnames such as:

```text
alpha.localhost
beta.localhost
admin.localhost
```
