// ---------------------------------------------------------------------------
// Domain types — Multi-Tenants HR (typed mock data layer, Phase 1)
// ---------------------------------------------------------------------------

export type PackageKey =
  | 'hr-core'
  | 'leave-management'
  | 'attendance-management'
  // Marketplace extensions
  | 'document-notes'
  | 'expense-requests'
  | 'company-announcements'
  | 'asset-register'
  | 'pulse-surveys'
  // System tools
  | 'org-chart'
  | 'bulk-importer'
  // Private extensions / standalone
  | 'custom-employee-approval'
  | 'custom-department-code'
  | 'custom-visitor-register'
  | 'custom-onboarding-checklist';

export type CompanyStatus = 'active' | 'suspended';

export type Portal = 'admin' | 'company';

export type Role = 'platform_super_admin' | 'company_admin' | 'company_user';

export interface Company {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: CompanyStatus;
  adminEmail: string;
  employeeCount: number;
  createdAt: string;
  /** Package keys enabled for this tenant. */
  packages: PackageKey[];
}

export interface Employee {
  id: string;
  tenantId: string;
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  department: string;
  position: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  status: 'active' | 'on_leave' | 'terminated';
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  head: string;
  status: 'active' | 'disabled';
}

export interface Position {
  id: string;
  tenantId: string;
  title: string;
  code: string;
  department: string;
  reportsTo: string;
  status: 'active' | 'disabled';
}

export interface CompanyUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: Exclude<Role, 'platform_super_admin'>;
  status: 'active' | 'disabled';
}

export type PackageType =
  | 'standard_update'
  | 'private_customization'
  | 'private_extension'
  | 'shared_extension'
  | 'bug_fix'
  | 'configuration_update'
  | 'security_update';

export type PackageStatus = 'draft' | 'released' | 'installed' | 'deprecated';

export type PackageTarget = 'all_companies' | 'selected_companies' | 'one_company';

export interface PackageVersion {
  version: string;
  releasedAt: string;
  notes: string;
}

export interface Package {
  key: PackageKey;
  name: string;
  version: string;
  type: PackageType;
  status: PackageStatus;
  target: PackageTarget;
  targetCompanyIds: string[];
  releaseNotes: string;
  installCount: number;
  diagnosticId: string;
  history: PackageVersion[];
}

export type RequestStatus =
  | 'received'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'in_development'
  | 'testing'
  | 'ready_for_release'
  | 'released'
  | 'installed'
  | 'closed';

export interface RequestRecord {
  id: string;
  companyId: string;
  sourceEmailReference: string;
  title: string;
  requestType: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: RequestStatus;
  internalNote: string;
  diagnosticId: string | null;
  linkedPackageKey: PackageKey | null;
  createdAt: string;
  updatedAt: string;
}

export type DiagnosticResult = 'PASS' | 'WARN' | 'FAIL';

/** Fixed impact dimensions a diagnostic evaluates a package version against. */
export type DiagnosticDimension =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'security'
  | 'dependency'
  | 'data_impact'
  | 'rollback'
  | 'test_evidence';

export interface DiagnosticCheck {
  dimension: DiagnosticDimension;
  status: DiagnosticResult;
  /** A required check in FAIL blocks release; non-required checks inform only. */
  required: boolean;
  detail: string;
}

export interface DiagnosticReport {
  id: string;
  packageKey: PackageKey;
  packageVersionId: string | null;
  targetCompanyId: string | null;
  affectedFrontend: string[];
  affectedBackend: string[];
  affectedTables: string[];
  requiredPermissions: string[];
  dependencies: string[];
  estimatedDataImpact: 'none' | 'create' | 'modify' | 'delete';
  compatibility: string;
  /** Derived from checks: FAIL > WARN > PASS. */
  result: DiagnosticResult;
  recommendation: string;
  /** Per-dimension checks (empty on the legacy mock records). */
  checks: DiagnosticCheck[];
}

export interface Installation {
  id: string;
  companyId: string;
  packageKey: PackageKey;
  packageVersion: string;
  state: 'assigned' | 'installing' | 'installed' | 'failed';
  assignedAt: string;
  activatedAt: string | null;
}

export interface UsageMetric {
  module: string;
  actionCount: number;
  companiesUsing: number;
}

export interface HealthSignal {
  label: string;
  value: string;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  /** Denormalized employee display name (joined for the table view). */
  employee: string;
  leaveType: 'annual' | 'sick' | 'unpaid';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  /** Denormalized employee display name (joined for the table view). */
  employee: string;
  date: string;
  /** Time-of-day 'HH:MM' or '' when not yet recorded. */
  checkIn: string;
  checkOut: string;
  /** Derived from check-in/out; never stored. */
  totalHours: number;
  status: 'present' | 'late' | 'absent';
  notes?: string;
}
