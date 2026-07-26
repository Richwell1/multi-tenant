# Product Requirements Document — Lightweight Multi-Tenant HR Package Demo

## 1. Product Summary

A small multi-tenant SaaS demo that proves company self-registration, email/password login, subdomain-based tenancy, role-based access, automatic HR Core assignment, all-company package updates, one-company custom packages, and simple release diagnostics.

## 2. Product Goals

The demo must prove that:

1. Two or more companies can self-register.
2. Every company receives a unique subdomain.
3. Company data is isolated.
4. Every new company automatically receives HR Core.
5. HR Core contains only Employees, Departments, and Positions.
6. The Platform Super Admin can release a standard update to all companies.
7. The Platform Super Admin can release a customization to one company only.
8. Package access changes the company navigation and available functionality.
9. Roles restrict platform and company actions.
10. Simple diagnostics show what a package affects before release.

## 3. Non-Goals

The demo shall not include:

- Password reset
- MFA
- Email verification
- Invitation-based onboarding
- Social login
- In-app chat
- Company request submission
- Complex approval workflows
- Full automated source analysis
- Shadow-database migration testing
- Full incident management
- Payroll, Recruitment, Performance, Training, or Benefits
- Billing
- Microservices, Kafka, or Kubernetes
- Separate company repositories, branches, or deployments

## 4. User Roles

### 4.1 Platform Super Admin

Can manage companies, request records, diagnostics, package releases, package targets, assignments, simple analytics, and system health.

### 4.2 Company Admin

Can manage the company HR Core data, view updates, activate assigned optional packages, and manage basic company users or roles.

### 4.3 Company User

Can view or use company HR Core functionality according to assigned permissions.

## 5. Functional Requirements

### 5.1 Company Registration

The system shall provide `/register`.

The registration form shall include:

- Company name
- Company slug
- Subdomain preview
- Admin full name
- Admin email
- Password
- Confirm password

On successful registration, the system shall create:

- A company tenant
- A unique company slug
- A company subdomain
- The first Company Admin
- Default roles
- An automatic HR Core assignment

The system shall reject duplicate company slugs and duplicate admin email accounts where applicable.

### 5.2 Login and Logout

The system shall provide:

- Email and password login
- Logout
- Invalid-credentials error
- Disabled-user blocking
- Suspended-company blocking

The demo shall not provide password reset, MFA, invitation acceptance, email verification, or social login.

### 5.3 Tenant Resolution and Subdomains

Each company shall have a unique subdomain.

Examples:

- `alpha-trading.exampleerp.com`
- `beta-manufacturing.exampleerp.com`

The backend shall verify that the authenticated user belongs to the company resolved from the subdomain.

### 5.4 Automatic HR Core Assignment

Every newly registered company shall automatically receive:

- Employees
- Departments
- Positions

The following shall not be enabled by default:

- Leave Management
- Attendance Management
- Payroll
- Recruitment
- Performance Management

### 5.5 Employee Management

Authorized company users shall be able to:

- View employees
- Add an employee
- Edit an employee
- View an employee profile
- Assign department
- Assign position
- Set employment status

Required demo employee fields:

- Employee number
- Full name
- Work email
- Department
- Position
- Employment type
- Status

### 5.6 Departments

Authorized company users shall be able to:

- View departments
- Add a department
- Edit a department
- Disable a department

Required demo fields:

- Department name
- Department code
- Department head
- Status

### 5.7 Positions

Authorized company users shall be able to:

- View positions
- Add a position
- Edit a position
- Disable a position

Required demo fields:

- Position title
- Position code
- Department
- Reports to
- Status

### 5.8 Request Records

Feature requests are received outside the application by email.

The Platform Super Admin shall be able to manually create a request record with:

- Company
- Source email reference
- Request title
- Request type
- Short description
- Priority
- Status
- Internal note
- Linked diagnostic
- Linked package

Supported statuses:

- Received
- Under Review
- Approved
- Rejected
- In Development
- Testing
- Ready for Release
- Released
- Installed
- Closed

The demo shall not include request chat, company request forms, message threads, or attachment exchange.

### 5.9 Package Management

The Platform Super Admin shall be able to:

- View packages
- Create a package definition and its initial version atomically
- Create additional package versions without publishing them
- Create a package release plan
- Add short release notes
- Classify the package
- Select a target
- View package status
- Enable or disable a package assignment
- Monitor each company's installation independently
- Retry a failed installation without reinstalling successful targets

Creating a package record does not generate feature code. Package behavior is
implemented in the shared application codebase and deployment. Private
packages remain metadata and entitlement boundaries within the same codebase;
they do not create customer branches or customer deployments.

Supported package classifications:

- Standard update — one, selected, or all active companies
- Private extension — one company; requires an enabled base package on the target
- Private customization (standalone private) — one company; no base package
- Shared extension — selected or all companies
- Bug fix

Required target options:

- All companies
- One company

**Demo scope (three workflows):** (1) a general HR Core update to all active
companies, (2) a private extension for one company that depends on a base
package, and (3) a standalone private package for one company. With "Install
automatically" checked, publishing enables and installs every active target in a
single transaction; if any target fails, the whole release rolls back with a
clear error. New active companies receive the latest released, diagnostic-PASS,
highest-semver HR Core version at registration (never hardcoded), and a newer
all-company HR Core release becomes the default for future registrations; only
HR Core is assigned automatically.

Selected-company targeting is also supported. The two-stage flow
(`automatic_install=false`) resolves active companies, creates one pending
installation per target, and processes each target independently. A failed
target must not remove successful installations; the failed row exposes a safe
reason and can
be retried individually.

### 5.10 Standard Update Flow

The Platform Super Admin shall be able to publish a standard update to all active companies.

Demo example:

```text
Attendance Management 1.0.0
Target: All companies
```

After activation, all active companies shall see Attendance in navigation or on the package list.

### 5.11 Private Customization Flow

The Platform Super Admin shall be able to publish a private package to one company.

Demo example:

```text
Leave Management 1.0.0
Target: Alpha Trading
```

After activation:

- Alpha shall see Leave Management.
- Beta shall not see Leave Management.
- Beta shall receive a forbidden response if it directly calls a Leave Management API.

### 5.12 Company Updates

A Company Admin shall be able to:

- View assigned updates
- View package name, version, release notes, and impact summary
- Confirm activation when required
- View success or failure
- View installed packages

The update interaction shall use a small three-step flow:

1. Review update
2. Confirm activation
3. View result

### 5.13 Lightweight Diagnostics

The Platform Super Admin shall be able to review a diagnostic report before publishing a package.

The diagnostic report shall include:

- Affected frontend areas
- Affected backend modules
- Affected database tables
- Required permissions
- Dependency summary
- Estimated data impact
- Target-company compatibility
- PASS, WARN, or FAIL result
- Short recommendation

For the demo, diagnostics may be generated from predefined package manifests and seeded company data.

A package with a FAIL result shall not be publishable through the user interface.

### 5.14 Role-Based Access

The system shall enforce:

- Platform Super Admin access to the control plane
- Company Admin access to company management actions
- Company User access only to allowed company functions
- No company user access to another company’s records
- No company user access to platform package targeting

### 5.15 Basic Usage and Health

The Platform Super Admin dashboard shall show:

- Total companies
- Active companies
- Companies using HR Core
- Companies using each optional package
- Most-used module
- Recent update activity
- API status
- Database status
- Basic uptime percentage

This data may be seeded or generated from simple usage events.

## 6. Required Screens

### 6.1 Public/Auth

- Login
- Register Company
- Access Denied
- Company Suspended

### 6.2 Platform Super Admin

- Dashboard
- Companies List
- Company Details
- Request Records List
- Create Request Record
- Request Record Details
- Packages List
- Create Package
- Create Package Version
- Create Package Release
- Release Details
- Package Details
- Package Targeting
- Diagnostic Report
- Package Assignments / Installations
- Basic Usage and Health

### 6.3 Company Workspace

- Dashboard
- Employees List
- Add/Edit Employee
- Employee Profile
- Departments List
- Add/Edit Department
- Positions List
- Add/Edit Position
- Available Updates
- Update Review and Confirmation
- Installed Packages
- Basic Users and Roles
- Settings

### 6.4 Optional Package Demonstration

- Alpha workspace with Leave Management visible
- Beta workspace without Leave Management
- Both workspaces with Attendance visible after the all-company update

## 7. Core Acceptance Criteria

1. Alpha and Beta can register independently.
2. Each company receives a different subdomain.
3. Each company sees only its own employee, department, and position records.
4. HR Core is automatically assigned during registration.
5. Alpha-only Leave Management is not visible to Beta.
6. Attendance targeted to all companies becomes visible to both.
7. A diagnostic report is shown before release.
8. A FAIL diagnostic disables the publish action.
9. Company users cannot access the Platform Super Admin portal.
10. The demonstration can be completed without email delivery, password reset, MFA, invitations, or in-app chat.

## 8. Implementation consistency and deferred scope

The current implementation uses one React/Vite application, one Supabase
project, Supabase Auth, PostgreSQL RLS, domain services, repository adapters,
and TanStack Query. The approved roles are `platform_super_admin`,
`company_admin`, and `company_user`; an `hr_manager` role is not part of this
product version.

The implemented platform surfaces include company registration and shared
login, tenant resolution, HR Core, Leave, Attendance, Request Records,
package releases and targeting, diagnostics, installation monitoring, usage,
audit, and system health. Hosted and local runtime selection is controlled by
`VITE_DATA_SOURCE`; the publishable Supabase key is the only browser key.

The application version is displayed from `package.json` through the shared
version module. Package release versions remain separate from the platform
version. Session restoration has an explicit failure state, and logout clears
the local session and tenant-scoped query cache even if remote sign-out fails.
Loading, empty, success, warning, error, retry, suspended, and confirmation
states are shared UI concerns rather than page-specific ad hoc behavior.

The following remain deferred and are not implied by the acceptance criteria:

- employee self-service identity linkage
- configurable leave types
- advanced attendance workflows
- automated browser visual/E2E coverage
- wildcard custom domains and tenant subdomain deployment
- time-series analytics
- diagnostic authoring beyond the current release gate
- automatic visual browser testing while the browser runner remains unavailable
