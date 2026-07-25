import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError, RepositoryError } from './errors';
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
import { SupabaseAttendanceRepository } from './attendance/supabase-attendance-repository';
import { SupabaseDepartmentRepository } from './departments/supabase-department-repository';
import { SupabaseEmployeeRepository } from './employees/supabase-employee-repository';
import { SupabaseLeaveRepository } from './leave/supabase-leave-repository';
import { SupabasePositionRepository } from './positions/supabase-position-repository';
import { SupabaseRequestRepository } from './requests/supabase-request-repository';
import { SupabaseDiagnosticRepository } from './diagnostics/supabase-diagnostic-repository';
import { SupabaseUsageRepository } from './usage/supabase-usage-repository';
import { SupabaseAuditRepository } from './audit/supabase-audit-repository';
import { SupabaseHealthRepository } from './health/supabase-health-repository';
import {
  SupabaseInstallationRepository,
} from './packages/supabase';

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  status: Company['status'];
  created_at: string;
  company_settings: { company_email: string | null } | null;
};

type AssignmentRow = {
  company_id: string;
  package_key: string;
  enabled: boolean;
  packages: { is_active: boolean } | null;
};

type EmployeeCountRow = { company_id: string };

const asPackageKey = (key: string): PackageKey => key as PackageKey;

const toLegacyInstallationState = (
  status: 'pending' | 'installing' | 'installed' | 'failed' | 'retrying' | 'rolled_back',
): Installation['state'] => {
  if (status === 'pending' || status === 'retrying') return 'installing';
  if (status === 'rolled_back') return 'failed';
  return status;
};

/**
 * Aggregate compatibility boundary for the original hooks API.
 *
 * Newer features use their focused repositories directly. This adapter keeps
 * the older aggregate hooks working when VITE_DATA_SOURCE=supabase without
 * duplicating their query logic or bypassing Supabase RLS.
 */
export class SupabaseRepository implements Repository {
  async getCompanies(): Promise<Company[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('companies')
      .select('id,name,slug,subdomain,status,created_at,company_settings(company_email)')
      .order('name');
    if (error) throw mapSupabaseError(error);

    const rows = (data ?? []) as unknown as CompanyRow[];
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);

    const [{ data: assignments, error: assignmentError }, { data: employees, error: employeeError }] =
      await Promise.all([
        client
          .from('company_packages')
          .select('company_id,package_key,enabled,packages!inner(is_active)')
          .in('company_id', ids),
        client.from('employees').select('company_id').in('company_id', ids),
      ]);
    if (assignmentError) throw mapSupabaseError(assignmentError);
    if (employeeError) throw mapSupabaseError(employeeError);

    const packageMap = new Map<string, PackageKey[]>();
    for (const row of (assignments ?? []) as unknown as AssignmentRow[]) {
      if (!row.enabled || !row.packages?.is_active) continue;
      const current = packageMap.get(row.company_id) ?? [];
      current.push(asPackageKey(row.package_key));
      packageMap.set(row.company_id, current);
    }

    const employeeCounts = new Map<string, number>();
    for (const row of (employees ?? []) as unknown as EmployeeCountRow[]) {
      employeeCounts.set(row.company_id, (employeeCounts.get(row.company_id) ?? 0) + 1);
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      subdomain: row.subdomain ?? row.slug,
      status: row.status,
      adminEmail: row.company_settings?.company_email ?? '',
      employeeCount: employeeCounts.get(row.id) ?? 0,
      createdAt: row.created_at.slice(0, 10),
      packages: packageMap.get(row.id) ?? [],
    }));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return (await this.getCompanies()).find((company) => company.id === id);
  }

  getRequests(): Promise<RequestRecord[]> {
    return new SupabaseRequestRepository().list();
  }

  getRequest(id: string): Promise<RequestRecord | undefined> {
    return new SupabaseRequestRepository().getById(id);
  }

  async getPackages(): Promise<Package[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('packages')
      .select('key,name,type,is_active,package_versions(version,notes,released_at)')
      .order('name');
    if (error) throw mapSupabaseError(error);

    return (data ?? []).map((row) => {
      const r = row as unknown as {
        key: string;
        name: string;
        type: Package['type'];
        is_active: boolean;
        package_versions: { version: string; notes: string; released_at: string | null }[];
      };
      const history = [...(r.package_versions ?? [])].sort((a, b) =>
        (b.released_at ?? '').localeCompare(a.released_at ?? ''),
      );
      const latest = history[0];
      return {
        key: asPackageKey(r.key),
        name: r.name,
        version: latest?.version ?? '',
        type: r.type,
        status: r.is_active ? 'released' : 'deprecated',
        target: 'all_companies',
        targetCompanyIds: [],
        releaseNotes: latest?.notes ?? '',
        installCount: 0,
        diagnosticId: '',
        history: history.map((item) => ({
          version: item.version,
          releasedAt: item.released_at ?? '',
          notes: item.notes,
        })),
      } satisfies Package;
    });
  }

  async getPackage(key: string): Promise<Package | undefined> {
    return (await this.getPackages()).find((pkg) => pkg.key === key);
  }

  getDiagnostic(id: string): Promise<DiagnosticReport | undefined> {
    return new SupabaseDiagnosticRepository().getById(id) as Promise<DiagnosticReport | undefined>;
  }

  getDiagnostics(): Promise<DiagnosticReport[]> {
    return new SupabaseDiagnosticRepository().list() as Promise<DiagnosticReport[]>;
  }

  async getInstallations(): Promise<Installation[]> {
    const rows = await new SupabaseInstallationRepository().list();
    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      packageKey: asPackageKey(row.packageCode),
      packageVersion: row.version,
      state: toLegacyInstallationState(row.status),
      assignedAt: row.startedAt,
      activatedAt: row.completedAt,
    }));
  }

  getUsage(): Promise<UsageMetric[]> {
    return new SupabaseUsageRepository().list() as Promise<UsageMetric[]>;
  }

  getHealth(): Promise<HealthSignal[]> {
    return new SupabaseHealthRepository().list() as Promise<HealthSignal[]>;
  }

  getAudit(): Promise<AuditLogEntry[]> {
    return new SupabaseAuditRepository().list() as Promise<AuditLogEntry[]>;
  }

  getEmployees(tenantId: string): Promise<Employee[]> {
    return new SupabaseEmployeeRepository().list(tenantId);
  }

  getEmployee(id: string): Promise<Employee | undefined> {
    return this.currentCompanyId().then((companyId) =>
      companyId ? new SupabaseEmployeeRepository().getById(companyId, id) : undefined,
    );
  }

  getDepartments(tenantId: string): Promise<Department[]> {
    return new SupabaseDepartmentRepository().list(tenantId);
  }

  getPositions(tenantId: string): Promise<Position[]> {
    return new SupabasePositionRepository().list(tenantId);
  }

  async getCompanyUsers(tenantId: string): Promise<CompanyUser[]> {
    const { data, error } = await getSupabaseClient()
      .from('company_memberships')
      .select('user_id,company_id,role,status')
      .eq('company_id', tenantId)
      .order('created_at');
    if (error) throw mapSupabaseError(error);

    // auth.users is intentionally not exposed through PostgREST. The current
    // schema stores membership identity, role, and status only; profile fields
    // can be added later without weakening the RLS boundary.
    return ((data ?? []) as unknown as Array<{
      user_id: string;
      company_id: string;
      role: CompanyUser['role'];
      status: CompanyUser['status'];
    }>).map((row) => ({
      id: row.user_id,
      tenantId: row.company_id,
      fullName: 'Company member',
      email: '',
      role: row.role,
      status: row.status,
    }));
  }

  async getInstallationsForTenant(tenantId: string): Promise<Installation[]> {
    const rows = await new SupabaseInstallationRepository().list({ companyIds: [tenantId] });
    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      packageKey: asPackageKey(row.packageCode),
      packageVersion: row.version,
      state: toLegacyInstallationState(row.status),
      assignedAt: row.startedAt,
      activatedAt: row.completedAt,
    }));
  }

  getLeaveRequests(tenantId: string): Promise<LeaveRequest[]> {
    return new SupabaseLeaveRepository().list(tenantId);
  }

  getAttendance(tenantId: string): Promise<AttendanceRecord[]> {
    return new SupabaseAttendanceRepository().list(tenantId);
  }

  async createEmployee(input: Omit<Employee, 'id' | 'status'>): Promise<Employee> {
    const client = getSupabaseClient();
    const [department, position] = await Promise.all([
      client.from('departments').select('id').eq('company_id', input.tenantId).eq('name', input.department).maybeSingle(),
      client.from('positions').select('id').eq('company_id', input.tenantId).eq('title', input.position).maybeSingle(),
    ]);
    if (department.error) throw mapSupabaseError(department.error);
    if (position.error) throw mapSupabaseError(position.error);
    return new SupabaseEmployeeRepository().create(input.tenantId, {
      employeeNumber: input.employeeNumber,
      fullName: input.fullName,
      workEmail: input.workEmail,
      departmentId: department.data?.id,
      positionId: position.data?.id,
      employmentType: input.employmentType,
    });
  }

  async disableDepartment(id: string): Promise<{ id: string }> {
    const { error } = await getSupabaseClient().from('departments').update({ status: 'disabled' }).eq('id', id);
    if (error) throw mapSupabaseError(error);
    return { id };
  }

  async createRequest(input: Partial<RequestRecord>): Promise<{ id: string }> {
    if (!input.companyId || !input.title || !input.requestType || !input.sourceEmailReference || !input.description || !input.priority) {
      throw new RepositoryError('Request fields are incomplete.', 'validation');
    }
    const result = await new SupabaseRequestRepository().create({
      companyId: input.companyId,
      title: input.title,
      requestType: input.requestType,
      sourceEmailReference: input.sourceEmailReference,
      description: input.description,
      priority: input.priority,
    });
    return { id: result.id };
  }

  async changeRequestStatus(id: string, status: RequestStatus): Promise<{ id: string; status: RequestStatus }> {
    const result = await new SupabaseRequestRepository().changeStatus(id, status);
    return { id: result.id, status: result.status };
  }

  async createPackage(input: Partial<Package>): Promise<{ key: string }> {
    if (!input.key || !input.name || !input.type) {
      throw new RepositoryError('Package fields are incomplete.', 'validation');
    }
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .insert({ key: input.key, name: input.name, type: input.type, is_active: true })
      .select('key')
      .single();
    if (error) throw mapSupabaseError(error);
    return { key: (data as { key: string }).key };
  }

  async assignPackage(packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }> {
    const { error } = await getSupabaseClient().from('company_packages').upsert(
      { company_id: companyId, package_key: packageKey, enabled: true, status: 'assigned' },
      { onConflict: 'company_id,package_key' },
    );
    if (error) throw mapSupabaseError(error);
    return { packageKey, companyId };
  }

  async saveSettings(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const companyId = await this.currentCompanyId();
    if (!companyId) throw new RepositoryError('No active company membership.', 'forbidden');
    const client = getSupabaseClient();
    const { error: companyError } = await client
      .from('companies')
      .update({ name: input.companyName })
      .eq('id', companyId);
    if (companyError) throw mapSupabaseError(companyError);
    const { error: settingsError } = await client.from('company_settings').upsert({
      company_id: companyId,
      company_email: input.email,
      phone: input.phone,
    });
    if (settingsError) throw mapSupabaseError(settingsError);
    return input;
  }

  installPackage(packageKey: PackageKey, companyId: string): Promise<{ packageKey: PackageKey; companyId: string }> {
    return this.assignPackage(packageKey, companyId);
  }

  private async currentCompanyId(): Promise<string | null> {
    const { data, error: userError } = await getSupabaseClient().auth.getUser();
    if (userError) throw mapSupabaseError(userError);
    if (!data.user) return null;
    const { data: membership, error } = await getSupabaseClient()
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', data.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return (membership as { company_id: string } | null)?.company_id ?? null;
  }
}
