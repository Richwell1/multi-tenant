// ---------------------------------------------------------------------------
// Async mock API. No real backend — every call returns a Promise with
// simulated latency so TanStack Query's pending/fetching/error states are
// genuine. Failures can be forced for demoing ErrorState + RetryAction.
// ---------------------------------------------------------------------------

import {
  attendanceRecords,
  auditLog,
  companies,
  companyUsers,
  departments,
  diagnostics,
  employees,
  healthSignals,
  installations,
  leaveRequests,
  packages,
  positions,
  requestRecords,
  usageMetrics,
} from './mock';
import type {
  AttendanceRecord,
  AuditLogEntry,
  Company,
  CompanyUser,
  Department,
  DiagnosticReport,
  Employee,
  HealthSignal,
  Installation,
  LeaveRequest,
  Package,
  PackageKey,
  Position,
  RequestRecord,
  RequestStatus,
  UsageMetric,
} from './types';
import type { Repository } from './repository.types';

/** A recoverable "network" error the UI can retry. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed. Please retry.') {
    super(message);
    this.name = 'NetworkError';
  }
}

const LATENCY = 500;

/**
 * Failure switch for demos/tests. Add a resource key to force its next read
 * to reject; the reject clears the flag so a retry succeeds.
 */
const forcedFailures = new Set<string>();
export function forceNextFailure(key: string) {
  forcedFailures.add(key);
}

function withLatency<T>(value: T, failKey?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (failKey && forcedFailures.has(failKey)) {
        forcedFailures.delete(failKey);
        reject(new NetworkError());
        return;
      }
      // deep clone so callers can't mutate the shared mock arrays
      resolve(structuredClone(value));
    }, LATENCY);
  });
}

// --- Reads --------------------------------------------------------------------

/**
 * Mock implementation of the {@link Repository} boundary. Kept behind the
 * interface so it can be swapped for a Supabase adapter without touching hooks.
 */
export const api: Repository = {
  getCompanies: (): Promise<Company[]> => withLatency(companies, 'companies'),
  getCompany: (id: string): Promise<Company | undefined> =>
    withLatency(companies.find((c) => c.id === id)),
  getEmployees: (tenantId: string): Promise<Employee[]> =>
    withLatency(employees.filter((e) => e.tenantId === tenantId), 'employees'),
  getEmployee: (id: string): Promise<Employee | undefined> =>
    withLatency(employees.find((e) => e.id === id)),
  getDepartments: (tenantId: string): Promise<Department[]> =>
    withLatency(departments.filter((d) => d.tenantId === tenantId), 'departments'),
  getPositions: (tenantId: string): Promise<Position[]> =>
    withLatency(positions.filter((p) => p.tenantId === tenantId), 'positions'),
  getCompanyUsers: (tenantId: string): Promise<CompanyUser[]> =>
    withLatency(companyUsers.filter((u) => u.tenantId === tenantId), 'users'),
  getRequests: (): Promise<RequestRecord[]> => withLatency(requestRecords, 'requests'),
  getRequest: (id: string): Promise<RequestRecord | undefined> =>
    withLatency(requestRecords.find((r) => r.id === id)),
  getPackages: (): Promise<Package[]> => withLatency(packages, 'packages'),
  getPackage: (key: string): Promise<Package | undefined> =>
    withLatency(packages.find((p) => p.key === key)),
  getDiagnostic: (id: string): Promise<DiagnosticReport | undefined> =>
    withLatency(diagnostics.find((d) => d.id === id) ?? diagnostics[0]),
  getDiagnostics: (): Promise<DiagnosticReport[]> => withLatency(diagnostics, 'diagnostics'),
  getInstallations: (): Promise<Installation[]> => withLatency(installations, 'installations'),
  getInstallationsForTenant: (tenantId: string): Promise<Installation[]> =>
    withLatency(installations.filter((i) => i.companyId === tenantId), 'installations'),
  getUsage: (): Promise<UsageMetric[]> => withLatency(usageMetrics, 'usage'),
  getHealth: (): Promise<HealthSignal[]> => withLatency(healthSignals, 'health'),
  getAudit: (): Promise<AuditLogEntry[]> => withLatency(auditLog, 'audit'),
  getLeaveRequests: (tenantId: string): Promise<LeaveRequest[]> =>
    withLatency(leaveRequests.filter((l) => l.tenantId === tenantId), 'leave'),
  getAttendance: (tenantId: string): Promise<AttendanceRecord[]> =>
    withLatency(attendanceRecords.filter((a) => a.tenantId === tenantId), 'attendance'),

  // --- Writes (mutations) -----------------------------------------------------

  createEmployee: (input: Omit<Employee, 'id' | 'status'>): Promise<Employee> =>
    withLatency<Employee>({ ...input, id: `e-${Date.now()}`, status: 'active' }, 'create-employee'),
  disableDepartment: (id: string): Promise<{ id: string }> =>
    withLatency({ id }, 'disable-department'),
  createRequest: (input: Partial<RequestRecord>): Promise<{ id: string }> =>
    withLatency({ id: `req-${Date.now()}`, ...input }, 'create-request'),
  changeRequestStatus: (id: string, status: RequestStatus): Promise<{ id: string; status: RequestStatus }> =>
    withLatency({ id, status }, 'request-status'),
  createPackage: (input: Partial<Package>): Promise<{ key: string }> =>
    withLatency({ key: `pkg-${Date.now()}`, ...input }, 'create-package'),
  assignPackage: (packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }> =>
    withLatency({ packageKey, companyId }, 'assign-package'),
  saveSettings: (input: Record<string, unknown>): Promise<Record<string, unknown>> =>
    withLatency(input, 'save-settings'),
  /** Installation step — can be forced to fail via forceNextFailure('install'). */
  installPackage: (packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }> =>
    withLatency({ packageKey, companyId }, 'install'),
};
