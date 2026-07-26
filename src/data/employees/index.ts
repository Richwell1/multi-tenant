import { resolveDataSource } from '@/data/repository';
import { MockEmployeeRepository } from './mock-employee-repository';
import type { EmployeeRepository } from './employee-repository';
import type { CreateEmployeeInput, TerminateEmployeeInput, UpdateEmployeeInput } from './types';

class LazySupabaseEmployeeRepository implements EmployeeRepository {
  private impl = () => {
    return import('./supabase-employee-repository').then((m) => new m.SupabaseEmployeeRepository());
  };
  list = (companyId: string) => {
    return this.impl().then((r) => r.list(companyId));
  };
  getById = (companyId: string, id: string) => {
    return this.impl().then((r) => r.getById(companyId, id));
  };
  create = (companyId: string, input: CreateEmployeeInput) => {
    return this.impl().then((r) => r.create(companyId, input));
  };
  update = (companyId: string, id: string, input: UpdateEmployeeInput) => {
    return this.impl().then((r) => r.update(companyId, id, input));
  };
  terminate = (companyId: string, id: string, input: TerminateEmployeeInput) => {
    return this.impl().then((r) => r.terminate(companyId, id, input));
  };
}

export function createEmployeeRepository(source = resolveDataSource()): EmployeeRepository {
  return source === 'supabase' ? new LazySupabaseEmployeeRepository() : new MockEmployeeRepository();
}

export const employeeRepository: EmployeeRepository = createEmployeeRepository();

export type { EmployeeRepository } from './employee-repository';
export type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  TerminateEmployeeInput,
  EmploymentType,
  EmployeeStatus,
} from './types';
