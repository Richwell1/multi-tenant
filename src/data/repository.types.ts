// ---------------------------------------------------------------------------
// Typed data-access boundary (dependency inversion). Hooks depend on this
// interface, not on any concrete data source. The mock implementation backs it
// today; a Supabase adapter can implement the same interface later with zero
// changes to hooks or pages.
// ---------------------------------------------------------------------------

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

export interface Repository {
  // Reads — platform scope
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getRequests(): Promise<RequestRecord[]>;
  getRequest(id: string): Promise<RequestRecord | undefined>;
  getPackages(): Promise<Package[]>;
  getPackage(key: string): Promise<Package | undefined>;
  getDiagnostic(id: string): Promise<DiagnosticReport | undefined>;
  getDiagnostics(): Promise<DiagnosticReport[]>;
  getInstallations(): Promise<Installation[]>;
  getUsage(): Promise<UsageMetric[]>;
  getHealth(): Promise<HealthSignal[]>;
  getAudit(): Promise<AuditLogEntry[]>;

  // Reads — tenant scope (always take a tenant/company id)
  getEmployees(tenantId: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getDepartments(tenantId: string): Promise<Department[]>;
  getPositions(tenantId: string): Promise<Position[]>;
  getCompanyUsers(tenantId: string): Promise<CompanyUser[]>;
  getInstallationsForTenant(tenantId: string): Promise<Installation[]>;
  getLeaveRequests(tenantId: string): Promise<LeaveRequest[]>;
  getAttendance(tenantId: string): Promise<AttendanceRecord[]>;

  // Writes
  createEmployee(input: Omit<Employee, 'id' | 'status'>): Promise<Employee>;
  disableDepartment(id: string): Promise<{ id: string }>;
  createRequest(input: Partial<RequestRecord>): Promise<{ id: string }>;
  changeRequestStatus(id: string, status: RequestStatus): Promise<{ id: string; status: RequestStatus }>;
  createPackage(input: Partial<Package>): Promise<{ key: string }>;
  assignPackage(packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }>;
  saveSettings(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  installPackage(packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }>;
}
