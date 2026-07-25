import type { CreateDepartmentInput, Department, UpdateDepartmentInput } from './types';

/** Company-scoped department data access. RLS remains the real boundary. */
export interface DepartmentRepository {
  list(companyId: string): Promise<Department[]>;
  getById(companyId: string, id: string): Promise<Department | undefined>;
  create(companyId: string, input: CreateDepartmentInput): Promise<Department>;
  update(companyId: string, id: string, input: UpdateDepartmentInput): Promise<Department>;
  disable(companyId: string, id: string): Promise<void>;
}
