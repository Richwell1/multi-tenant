// ---------------------------------------------------------------------------
// Typed mock data — no backend. Phase 1 only.
// Business rules encoded here:
//   Alpha Trading      -> HR Core + Leave Management
//   Beta Manufacturing -> HR Core only  (must NOT see /leave)
//   Attendance Management -> releasable to all companies
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
  Position,
  RequestRecord,
  UsageMetric,
} from './types';

export const companies: Company[] = [
  {
    id: 'alpha',
    name: 'Alpha Trading',
    slug: 'alpha-trading',
    subdomain: 'alpha.multi-tenants-hr.com',
    status: 'active',
    adminEmail: 'admin@alpha-trading.com',
    employeeCount: 42,
    createdAt: '2026-01-14',
    packages: ['hr-core', 'leave-management'],
  },
  {
    id: 'beta',
    name: 'Beta Manufacturing',
    slug: 'beta-manufacturing',
    subdomain: 'beta.multi-tenants-hr.com',
    status: 'active',
    adminEmail: 'admin@beta-manufacturing.com',
    employeeCount: 78,
    createdAt: '2026-02-03',
    packages: ['hr-core'],
  },
  {
    id: 'gamma',
    name: 'Gamma Logistics',
    slug: 'gamma-logistics',
    subdomain: 'gamma.multi-tenants-hr.com',
    status: 'suspended',
    adminEmail: 'admin@gamma-logistics.com',
    employeeCount: 12,
    createdAt: '2026-03-21',
    packages: ['hr-core'],
  },
];

export const employees: Employee[] = [
  { id: 'e1', tenantId: 'alpha', employeeNumber: 'ALP-001', fullName: 'Maria Santos', workEmail: 'maria@alpha-trading.com', department: 'Finance', position: 'Accountant', employmentType: 'full_time', status: 'active' },
  { id: 'e2', tenantId: 'alpha', employeeNumber: 'ALP-002', fullName: 'James Okoro', workEmail: 'james@alpha-trading.com', department: 'Sales', position: 'Sales Lead', employmentType: 'full_time', status: 'active' },
  { id: 'e3', tenantId: 'alpha', employeeNumber: 'ALP-003', fullName: 'Wei Chen', workEmail: 'wei@alpha-trading.com', department: 'Operations', position: 'Analyst', employmentType: 'contract', status: 'on_leave' },
  { id: 'e4', tenantId: 'beta', employeeNumber: 'BET-001', fullName: 'Nadia Rahman', workEmail: 'nadia@beta-manufacturing.com', department: 'Production', position: 'Line Manager', employmentType: 'full_time', status: 'active' },
  { id: 'e5', tenantId: 'beta', employeeNumber: 'BET-002', fullName: 'Tom Becker', workEmail: 'tom@beta-manufacturing.com', department: 'Quality', position: 'QA Inspector', employmentType: 'part_time', status: 'active' },
];

export const departments: Department[] = [
  { id: 'd1', tenantId: 'alpha', name: 'Finance', code: 'FIN', head: 'Maria Santos', status: 'active' },
  { id: 'd2', tenantId: 'alpha', name: 'Sales', code: 'SAL', head: 'James Okoro', status: 'active' },
  { id: 'd3', tenantId: 'alpha', name: 'Operations', code: 'OPS', head: 'Wei Chen', status: 'active' },
  { id: 'd4', tenantId: 'beta', name: 'Production', code: 'PRD', head: 'Nadia Rahman', status: 'active' },
  { id: 'd5', tenantId: 'beta', name: 'Quality', code: 'QA', head: 'Tom Becker', status: 'disabled' },
];

export const positions: Position[] = [
  { id: 'p1', tenantId: 'alpha', title: 'Accountant', code: 'ACC', department: 'Finance', reportsTo: 'Finance Head', status: 'active' },
  { id: 'p2', tenantId: 'alpha', title: 'Sales Lead', code: 'SLD', department: 'Sales', reportsTo: 'Sales Director', status: 'active' },
  { id: 'p3', tenantId: 'beta', title: 'Line Manager', code: 'LMG', department: 'Production', reportsTo: 'Plant Manager', status: 'active' },
  { id: 'p4', tenantId: 'beta', title: 'QA Inspector', code: 'QAI', department: 'Quality', reportsTo: 'QA Lead', status: 'active' },
];

export const companyUsers: CompanyUser[] = [
  { id: 'u1', tenantId: 'alpha', fullName: 'Alpha Admin', email: 'admin@alpha-trading.com', role: 'company_admin', status: 'active' },
  { id: 'u2', tenantId: 'alpha', fullName: 'Maria Santos', email: 'maria@alpha-trading.com', role: 'company_user', status: 'active' },
  { id: 'u3', tenantId: 'beta', fullName: 'Beta Admin', email: 'admin@beta-manufacturing.com', role: 'company_admin', status: 'active' },
  { id: 'u4', tenantId: 'beta', fullName: 'Tom Becker', email: 'tom@beta-manufacturing.com', role: 'company_user', status: 'disabled' },
];

export const diagnostics: DiagnosticReport[] = [
  {
    id: 'diag-leave',
    packageKey: 'leave-management',
    targetCompanyId: 'alpha',
    affectedFrontend: ['/leave', 'Company Sidebar', 'Company Dashboard'],
    affectedBackend: ['extensions/leave-management'],
    affectedTables: ['leave_requests', 'company_packages'],
    requiredPermissions: ['packages.activate', 'employees.view'],
    dependencies: ['hr-core'],
    estimatedDataImpact: 'create',
    compatibility: 'Compatible with Alpha Trading (HR Core present)',
    result: 'PASS',
    recommendation: 'Safe to release to Alpha Trading.',
  },
  {
    id: 'diag-attendance',
    packageKey: 'attendance-management',
    targetCompanyId: null,
    affectedFrontend: ['/attendance', 'Company Sidebar'],
    affectedBackend: ['extensions/attendance-management'],
    affectedTables: ['attendance_records', 'company_packages'],
    requiredPermissions: ['packages.activate'],
    dependencies: ['hr-core'],
    estimatedDataImpact: 'create',
    compatibility: 'Compatible with all active companies',
    result: 'WARN',
    recommendation: 'Confirm activation window before releasing to all companies.',
  },
];

export const packages: Package[] = [
  {
    key: 'hr-core',
    name: 'HR Core',
    version: '1.0.0',
    type: 'standard_update',
    status: 'installed',
    target: 'all_companies',
    targetCompanyIds: ['alpha', 'beta', 'gamma'],
    releaseNotes: 'Employees, Departments, and Positions. Auto-assigned on registration.',
    installCount: 3,
    diagnosticId: 'diag-leave',
    history: [{ version: '1.0.0', releasedAt: '2026-01-01', notes: 'Initial HR Core release.' }],
  },
  {
    key: 'leave-management',
    name: 'Leave Management',
    version: '1.0.0',
    type: 'private_customization',
    status: 'released',
    target: 'one_company',
    targetCompanyIds: ['alpha'],
    releaseNotes: 'Private customization for Alpha Trading. Leave requests, approval flow.',
    installCount: 1,
    diagnosticId: 'diag-leave',
    history: [{ version: '1.0.0', releasedAt: '2026-04-10', notes: 'Alpha-only private release.' }],
  },
  {
    key: 'attendance-management',
    name: 'Attendance Management',
    version: '1.0.0',
    type: 'standard_update',
    status: 'draft',
    target: 'all_companies',
    targetCompanyIds: [],
    releaseNotes: 'Standard update. Targetable to all companies.',
    installCount: 0,
    diagnosticId: 'diag-attendance',
    history: [{ version: '1.0.0', releasedAt: '', notes: 'Prepared for all-company rollout.' }],
  },
];

export const requestRecords: RequestRecord[] = [
  {
    id: 'req-1',
    companyId: 'alpha',
    sourceEmailReference: 'EML-2026-0417',
    title: 'Need leave tracking for staff',
    requestType: 'New Package',
    description: 'Alpha requested a way to manage annual and sick leave.',
    priority: 'high',
    status: 'released',
    internalNote: 'Delivered as private customization.',
    diagnosticId: 'diag-leave',
    linkedPackageKey: 'leave-management',
    createdAt: '2026-04-01',
    updatedAt: '2026-04-10',
  },
  {
    id: 'req-2',
    companyId: 'beta',
    sourceEmailReference: 'EML-2026-0502',
    title: 'Attendance clock-in system',
    requestType: 'Standard Update',
    description: 'Beta asked about attendance tracking; being considered for all companies.',
    priority: 'medium',
    status: 'under_review',
    internalNote: 'Candidate for all-company standard update.',
    diagnosticId: 'diag-attendance',
    linkedPackageKey: 'attendance-management',
    createdAt: '2026-05-02',
    updatedAt: '2026-05-05',
  },
];

export const installations: Installation[] = [
  { id: 'i1', companyId: 'alpha', packageKey: 'hr-core', packageVersion: '1.0.0', state: 'installed', assignedAt: '2026-01-14', activatedAt: '2026-01-14' },
  { id: 'i2', companyId: 'beta', packageKey: 'hr-core', packageVersion: '1.0.0', state: 'installed', assignedAt: '2026-02-03', activatedAt: '2026-02-03' },
  { id: 'i3', companyId: 'gamma', packageKey: 'hr-core', packageVersion: '1.0.0', state: 'installed', assignedAt: '2026-03-21', activatedAt: '2026-03-21' },
  { id: 'i4', companyId: 'alpha', packageKey: 'leave-management', packageVersion: '1.0.0', state: 'installed', assignedAt: '2026-04-10', activatedAt: '2026-04-11' },
];

export const usageMetrics: UsageMetric[] = [
  { module: 'employees', actionCount: 1240, companiesUsing: 3 },
  { module: 'departments', actionCount: 320, companiesUsing: 3 },
  { module: 'positions', actionCount: 210, companiesUsing: 3 },
  { module: 'leave', actionCount: 86, companiesUsing: 1 },
  { module: 'attendance', actionCount: 0, companiesUsing: 0 },
];

export const healthSignals: HealthSignal[] = [
  { label: 'API', value: 'Operational', status: 'healthy' },
  { label: 'Database', value: 'Operational', status: 'healthy' },
  { label: 'Uptime (30d)', value: '99.94%', status: 'healthy' },
  { label: 'Job Queue', value: 'Slight delay', status: 'degraded' },
];

export const auditLog: AuditLogEntry[] = [
  { id: 'a1', timestamp: '2026-04-10T09:12:00Z', actor: 'superadmin', action: 'Released package', target: 'Leave Management 1.0.0 → Alpha Trading' },
  { id: 'a2', timestamp: '2026-03-21T14:03:00Z', actor: 'superadmin', action: 'Suspended company', target: 'Gamma Logistics' },
  { id: 'a3', timestamp: '2026-02-03T10:44:00Z', actor: 'system', action: 'Auto-assigned HR Core', target: 'Beta Manufacturing' },
];

export const leaveRequests: LeaveRequest[] = [
  { id: 'l1', tenantId: 'alpha', employeeId: 'e3', employee: 'Wei Chen', leaveType: 'annual', startDate: '2026-06-01', endDate: '2026-06-07', status: 'approved' },
  { id: 'l2', tenantId: 'alpha', employeeId: 'e1', employee: 'Maria Santos', leaveType: 'sick', startDate: '2026-05-20', endDate: '2026-05-21', status: 'pending' },
];

export const attendanceRecords: AttendanceRecord[] = [
  { id: 'at1', tenantId: 'alpha', employeeId: 'e1', employee: 'Maria Santos', date: '2026-05-18', checkIn: '09:02', checkOut: '17:30', totalHours: 8.5, status: 'present' },
  { id: 'at2', tenantId: 'beta', employeeId: 'e4', employee: 'Nadia Rahman', date: '2026-05-18', checkIn: '08:15', checkOut: '16:40', totalHours: 8.4, status: 'present' },
];
