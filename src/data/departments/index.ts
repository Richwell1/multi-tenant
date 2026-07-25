import { resolveDataSource } from '@/data/repository';
import { MockDepartmentRepository } from './mock-department-repository';
import type { DepartmentRepository } from './department-repository';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './types';

/** Lazy Supabase adapter — keeps the SDK out of the default bundle. */
class LazySupabaseDepartmentRepository implements DepartmentRepository {
  private impl() {
    return import('./supabase-department-repository').then((m) => new m.SupabaseDepartmentRepository());
  }
  list(companyId: string) {
    return this.impl().then((r) => r.list(companyId));
  }
  getById(companyId: string, id: string) {
    return this.impl().then((r) => r.getById(companyId, id));
  }
  create(companyId: string, input: CreateDepartmentInput) {
    return this.impl().then((r) => r.create(companyId, input));
  }
  update(companyId: string, id: string, input: UpdateDepartmentInput) {
    return this.impl().then((r) => r.update(companyId, id, input));
  }
  disable(companyId: string, id: string) {
    return this.impl().then((r) => r.disable(companyId, id));
  }
}

export function createDepartmentRepository(source = resolveDataSource()): DepartmentRepository {
  return source === 'supabase' ? new LazySupabaseDepartmentRepository() : new MockDepartmentRepository();
}

export const departmentRepository: DepartmentRepository = createDepartmentRepository();

export type { DepartmentRepository } from './department-repository';
export type { Department, CreateDepartmentInput, UpdateDepartmentInput } from './types';
