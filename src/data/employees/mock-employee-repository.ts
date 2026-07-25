import { departments, employees, positions } from '@/data/mock';
import type { EmployeeRepository } from './employee-repository';
import type {
  CreateEmployeeInput,
  Employee,
  TerminateEmployeeInput,
  UpdateEmployeeInput,
} from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

const deptName = (companyId: string, id?: string) =>
  id ? (departments.find((d) => d.tenantId === companyId && d.id === id)?.name ?? '') : '';
const posTitle = (companyId: string, id?: string) =>
  id ? (positions.find((p) => p.tenantId === companyId && p.id === id)?.title ?? '') : '';

/** Mock adapter — reads the static seed; mutations are simulated (no persistence). */
export class MockEmployeeRepository implements EmployeeRepository {
  async list(companyId: string): Promise<Employee[]> {
    await delay();
    return clone(employees.filter((e) => e.tenantId === companyId));
  }

  async getById(companyId: string, id: string): Promise<Employee | undefined> {
    await delay();
    return clone(employees.find((e) => e.tenantId === companyId && e.id === id));
  }

  async create(companyId: string, input: CreateEmployeeInput): Promise<Employee> {
    await delay();
    return {
      id: `e-${Date.now()}`,
      tenantId: companyId,
      employeeNumber: input.employeeNumber,
      fullName: input.fullName,
      workEmail: input.workEmail,
      department: deptName(companyId, input.departmentId),
      position: posTitle(companyId, input.positionId),
      employmentType: input.employmentType,
      status: 'active',
    };
  }

  async update(companyId: string, id: string, input: UpdateEmployeeInput): Promise<Employee> {
    await delay();
    const e = employees.find((x) => x.tenantId === companyId && x.id === id);
    return {
      id,
      tenantId: companyId,
      employeeNumber: e?.employeeNumber ?? '',
      fullName: input.fullName ?? e?.fullName ?? '',
      workEmail: input.workEmail ?? e?.workEmail ?? '',
      department: input.departmentId ? deptName(companyId, input.departmentId) : (e?.department ?? ''),
      position: input.positionId ? posTitle(companyId, input.positionId) : (e?.position ?? ''),
      employmentType: input.employmentType ?? e?.employmentType ?? 'full_time',
      status: input.status ?? e?.status ?? 'active',
    };
  }

  async terminate(companyId: string, id: string, _input: TerminateEmployeeInput): Promise<Employee> {
    void _input;
    await delay();
    const e = employees.find((x) => x.tenantId === companyId && x.id === id);
    return {
      id,
      tenantId: companyId,
      employeeNumber: e?.employeeNumber ?? '',
      fullName: e?.fullName ?? '',
      workEmail: e?.workEmail ?? '',
      department: e?.department ?? '',
      position: e?.position ?? '',
      employmentType: e?.employmentType ?? 'full_time',
      status: 'terminated',
    };
  }
}
