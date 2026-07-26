# Multi-Tenant HR Package Demo — Overview

## 1. Purpose

This is a lightweight demonstration of a multi-tenant SaaS platform. It is not a full ERP or production-ready HR system.

The demo is designed to prove six ideas:

1. Multiple companies can register and use one shared application.
2. Every company receives its own subdomain and isolated data.
3. Every company automatically receives the same standard HR Core package.
4. A standard package update can be released to all companies.
5. A custom package can be assigned to only one selected company.
6. The Platform Super Admin can review simple diagnostics before releasing an update.

## 2. Main Demo Scenario

During the demonstration:

1. Register **Alpha Trading** at `/register`.
2. Register **Beta Manufacturing** at `/register`.
3. The system creates:
   - `alpha-trading.exampleerp.com`
   - `beta-manufacturing.exampleerp.com`
4. Log in to both companies using email and password.
5. Confirm that both companies automatically receive HR Core:
   - Employees
   - Departments
   - Positions
6. Create sample departments, positions, and employees for each company.
7. In the Platform Super Admin portal, create a request record for Alpha Trading based on an email request for Leave Management.
8. Review a simple diagnostic summary.
9. Create and assign **Leave Management 1.0.0** to Alpha only.
10. Confirm that Alpha sees Leave Management while Beta does not.
11. Create **Attendance 1.0.0** as a standard update targeted to all companies.
12. Confirm that both companies receive Attendance.

## 3. Authentication

Authentication is intentionally simple:

- Company registration with email and password
- Email and password login
- Logout

The demo does not include:

- Password reset
- MFA
- Email verification
- Invitation emails
- Social login
- Magic links

A seeded Platform Super Admin account is used to access the control plane.

## 4. Company Registration

A company registers itself at:

```text
/register
```

The form collects:

- Company name
- Company slug
- Subdomain preview
- Admin full name
- Admin email
- Password
- Confirm password

On successful registration, the system creates:

- The company tenant
- The first Company Admin account
- The unique company subdomain
- The standard HR Core assignment
- Default roles

## 5. Standard HR Core

Every new company automatically receives:

- Employee Management
- Departments
- Positions

Leave Management and Attendance are not included by default.

## 6. Package Types

### Standard update

Released to all companies.

Example:

```text
Attendance Management 1.0.0
Target: All companies
```

### Private customization

Released to one company only.

Example:

```text
Leave Management 1.0.0
Target: Alpha Trading only
```

### Shared extension

The architecture supports selected-company targeting, but the demo only needs to visibly prove all-company and one-company targeting.

## 7. Request and Approval Records

Companies request features outside the application by email.

The Platform Super Admin manually creates a simple request record containing:

- Company
- Request title
- Request type
- Email reference
- Short description
- Priority
- Status
- Internal note
- Linked diagnostic result
- Linked package

There is no in-app request chat, company request form, attachment workflow, or complex approval process.

## 8. Lightweight Diagnostics

Before publishing a package, the Platform Super Admin sees a simple diagnostic report showing:

- Affected frontend screens
- Affected backend modules
- Affected database tables
- Required permissions
- Estimated data impact
- Package dependencies
- Target-company compatibility
- PASS, WARN, or FAIL result

The demo uses predefined package manifests and seeded diagnostic results. It does not perform full source-code analysis or shadow-database simulation.

## 9. Roles

### Platform Super Admin

Can:

- View all companies
- View company subdomains
- Create request records
- Change request status
- Review diagnostics
- Create package releases
- Target all companies or one company
- Monitor package assignment and installation
- View simple usage and health information

### Company Admin

Can:

- Manage employees
- Manage departments
- Manage positions
- View available updates
- Install or activate assigned optional packages
- View installed packages

### Company User

Can:

- View employees, departments, and positions
- Access only actions allowed by the assigned role

## 10. Lightweight Platform Visibility

The Platform Super Admin dashboard shows only essential demo metrics:

- Total companies
- Active companies
- Companies using each package
- Most-used module
- Recent package updates
- Basic API and database health
- Recent package failure, if any

## 11. Explicit Non-Goals

The demo does not include:

- Full payroll
- Recruitment
- Performance management
- Benefits or training
- Advanced leave or attendance workflows
- In-app chat
- Company request submission
- Password reset or MFA
- Invitation emails
- Billing
- Complex analytics
- Full incident management
- Automatic code-impact scanning
- Microservices
- Kafka or Kubernetes
- Separate repositories, branches, or deployments per company

## 12. Success Definition

The demo succeeds when the supervisor can clearly see:

1. Two independently registered companies.
2. Different company subdomains.
3. Data isolation between the companies.
4. The same standard HR Core for both companies.
5. A private package visible only to Alpha.
6. A standard update visible to both Alpha and Beta.
7. A simple diagnostic result before a package is released.
8. Role-based differences between Platform Super Admin and company users.

## 13. Current implementation notes

The running application is a React/Vite SPA with a Supabase-backed runtime and
a seeded mock runtime for local demonstration work. Repository factories keep
those data sources behind the same domain interfaces. Supabase mode uses real
company UUIDs, authenticated RLS, package entitlements, and server-authorized
RPCs; the browser never uses a service-role key.

The shared shell and public authentication screens display platform version
`v0.1.0`, sourced from `package.json`. This is independent from package release
versions such as Leave Management `1.0.0`. Session restoration and logout have
explicit failure-safe behavior, and zero-row results are presented as valid
empty states.

Local CI covers typecheck, lint, application tests, production build, and the
94-scenario SQL/RLS matrix. Full hosted browser smoke testing and wildcard
custom domains remain deployment work rather than completed automated coverage.
