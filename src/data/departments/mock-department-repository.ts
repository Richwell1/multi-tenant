import { departments } from '@/data/mock';
import type { DepartmentRepository } from './department-repository';
import type { CreateDepartmentInput, Department, UpdateDepartmentInput } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

/** Mock adapter — reads the static seed; mutations are simulated (no persistence). */
export class MockDepartmentRepository implements DepartmentRepository {
  async list(companyId: string): Promise<Department[]> {
    await delay();
    return clone(departments.filter((d) => d.tenantId === companyId));
  }

  async getById(companyId: string, id: string): Promise<Department | undefined> {
    await delay();
    return clone(departments.find((d) => d.tenantId === companyId && d.id === id));
  }

  async create(companyId: string, input: CreateDepartmentInput): Promise<Department> {
    await delay();
    return {
      id: `d-${Date.now()}`,
      tenantId: companyId,
      name: input.name,
      code: input.code ?? '',
      head: input.head ?? '',
      status: 'active',
    };
  }

  async update(companyId: string, id: string, input: UpdateDepartmentInput): Promise<Department> {
    await delay();
    const existing = departments.find((d) => d.tenantId === companyId && d.id === id);
    return {
      id,
      tenantId: companyId,
      name: input.name ?? existing?.name ?? '',
      code: input.code ?? existing?.code ?? '',
      head: input.head ?? existing?.head ?? '',
      status: input.status ?? existing?.status ?? 'active',
    };
  }

  async disable(): Promise<void> {
    await delay();
  }
}
