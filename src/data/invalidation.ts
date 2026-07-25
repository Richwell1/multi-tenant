// ---------------------------------------------------------------------------
// Scoped cache-invalidation rules — the single source of truth for "which
// queries does this mutation affect?". Pure functions so they can be unit
// tested, and so mutation hooks never hand-roll invalidation inline.
//
// Keys are query-key PREFIXES; TanStack Query invalidates by prefix match, so
// e.g. invalidating ['employees', 'alpha'] refreshes that company's list AND
// detail queries — but never Beta's, whose keys start ['employees', 'beta'].
// ---------------------------------------------------------------------------

import type { QueryKey } from '@tanstack/react-query';
import { queryKeys as k } from '@/lib/query-keys';

export const invalidationTargets = {
  createEmployee: (companyId: string): QueryKey[] => [
    k.employees.all(companyId), // list + detail for this company (dashboard reads the list)
    k.usage.all,
    k.audit.all,
  ],

  updateEmployee: (companyId: string, employeeId: string): QueryKey[] => [
    k.employees.detail(companyId, employeeId),
    k.employees.list(companyId),
    k.audit.all,
  ],

  terminateEmployee: (companyId: string, employeeId: string): QueryKey[] => [
    k.employees.detail(companyId, employeeId),
    k.employees.all(companyId),
    k.audit.all,
  ],

  createDepartment: (companyId: string): QueryKey[] => [
    k.departments.all(companyId),
    k.employees.all(companyId), // department labels are embedded on employees
    k.audit.all,
  ],

  updateDepartment: (companyId: string): QueryKey[] => [
    k.departments.all(companyId),
    k.positions.all(companyId), // positions reference departments
    k.employees.all(companyId),
    k.audit.all,
  ],

  disableDepartment: (companyId: string): QueryKey[] => [
    k.departments.all(companyId),
    k.employees.all(companyId), // department labels are embedded on employees
    k.audit.all,
  ],

  createPosition: (companyId: string): QueryKey[] => [
    k.positions.all(companyId),
    k.employees.all(companyId), // position labels are embedded on employees
    k.audit.all,
  ],
  disablePosition: (companyId: string): QueryKey[] => [
    k.positions.all(companyId),
    k.employees.all(companyId),
    k.audit.all,
  ],

  createLeaveRequest: (companyId: string): QueryKey[] => [
    k.leave.all(companyId), // list for this company
    k.audit.all,
  ],

  decideLeaveRequest: (companyId: string): QueryKey[] => [
    k.leave.all(companyId),
    k.audit.all,
  ],

  createAttendance: (companyId: string): QueryKey[] => [
    k.attendance.all(companyId), // records list for this company
    k.audit.all,
  ],

  checkOutAttendance: (companyId: string): QueryKey[] => [
    k.attendance.all(companyId),
    k.audit.all,
  ],

  /** Running a diagnostic changes the version's diagnostic status (release gate). */
  runDiagnostic: (): QueryKey[] => [k.diagnostics.all, k.packages.all, k.audit.all],

  createRequest: (): QueryKey[] => [k.requests.all, k.audit.all],

  changeRequestStatus: (requestId: string): QueryKey[] => [
    k.requests.detail(requestId),
    k.requests.all,
    k.audit.all,
  ],

  /** Publishing a release ripples into installs, analytics, audit, diagnostics. */
  createPackage: (): QueryKey[] => [
    k.packages.all,
    k.installations.all,
    k.usage.all,
    k.audit.all,
    ['diagnostics'],
  ],

  /** Private customization assigned to ONE company — must not touch others. */
  assignPackageToCompany: (companyId: string): QueryKey[] => [
    k.packages.company(companyId),
    k.companies.detail(companyId),
    k.installations.all,
    k.packages.all,
    k.audit.all,
    ['diagnostics'],
  ],

  /** Standard update released to all companies. */
  releaseStandardPackage: (): QueryKey[] => [
    k.packages.all,
    k.installations.all,
    k.usage.all,
    k.audit.all,
    ['diagnostics'],
  ],

  /**
   * Publishing a release affects packages, installations, every company's
   * assignments, and any loaded company entitlement context (nav/PackageGuard
   * refresh). Prefixes keep it scoped — never the whole cache.
   */
  publishRelease: (): QueryKey[] => [
    k.packages.all,
    k.installations.all,
    k.companies.all,
    k.audit.all,
    ['package-assignments'],
    ['context'],
  ],

  installPackage: (companyId: string): QueryKey[] => [
    k.installations.all,
    k.installations.company(companyId),
    k.packages.company(companyId),
  ],

  /** Recovery (retry/rollback) flips the install state AND the company entitlement. */
  recoverInstallation: (companyId: string): QueryKey[] => [
    k.installations.all,
    k.packages.all,
    k.packages.company(companyId),
    k.audit.all,
  ],

  saveSettings: (companyId: string): QueryKey[] => [k.companies.detail(companyId)],
};
