import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { EmployeeRepository } from './employee-repository';
import type {
  CreateEmployeeInput,
  Employee,
  EmploymentType,
  EmployeeStatus,
  TerminateEmployeeInput,
  UpdateEmployeeInput,
} from './types';

const COLS =
  'id,company_id,employee_number,full_name,work_email,employment_type,status,departments(name),positions(title)';

interface Row {
  id: string;
  company_id: string;
  employee_number: string;
  full_name: string;
  work_email: string | null;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  departments: { name: string } | null;
  positions: { title: string } | null;
}

const toDomain = (r: Row): Employee => ({
  id: r.id,
  tenantId: r.company_id,
  employeeNumber: r.employee_number,
  fullName: r.full_name,
  workEmail: r.work_email ?? '',
  department: r.departments?.name ?? '',
  position: r.positions?.title ?? '',
  employmentType: r.employment_type,
  status: r.status,
});

export class SupabaseEmployeeRepository implements EmployeeRepository {
  async list(companyId: string): Promise<Employee[]> {
    const { data, error } = await getSupabaseClient()
      .from('employees')
      .select(COLS)
      .eq('company_id', companyId)
      .order('full_name');
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async getById(companyId: string, id: string): Promise<Employee | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('employees')
      .select(COLS)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? toDomain(data as unknown as Row) : undefined;
  }

  async create(companyId: string, input: CreateEmployeeInput): Promise<Employee> {
    const { data, error } = await getSupabaseClient()
      .from('employees')
      .insert({
        company_id: companyId,
        employee_number: input.employeeNumber,
        full_name: input.fullName,
        work_email: input.workEmail || null,
        department_id: input.departmentId ?? null,
        position_id: input.positionId ?? null,
        employment_type: input.employmentType,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async update(companyId: string, id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.workEmail !== undefined) patch.work_email = input.workEmail || null;
    if (input.departmentId !== undefined) patch.department_id = input.departmentId || null;
    if (input.positionId !== undefined) patch.position_id = input.positionId || null;
    if (input.employmentType !== undefined) patch.employment_type = input.employmentType;
    if (input.status !== undefined) patch.status = input.status;
    const { data, error } = await getSupabaseClient()
      .from('employees')
      .update(patch)
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async terminate(companyId: string, id: string, input: TerminateEmployeeInput): Promise<Employee> {
    const { data, error } = await getSupabaseClient()
      .from('employees')
      .update({
        status: 'terminated',
        termination_date: new Date().toISOString().slice(0, 10),
        termination_reason: input.reason ?? null,
      })
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
