import type {
  CreateEmployeeInput,
  Employee,
  TerminateEmployeeInput,
  UpdateEmployeeInput,
} from './types';

/** Company-scoped employee data access. RLS + composite FKs are the real boundary. */
export interface EmployeeRepository {
  list(companyId: string): Promise<Employee[]>;
  getById(companyId: string, id: string): Promise<Employee | undefined>;
  create(companyId: string, input: CreateEmployeeInput): Promise<Employee>;
  update(companyId: string, id: string, input: UpdateEmployeeInput): Promise<Employee>;
  terminate(companyId: string, id: string, input: TerminateEmployeeInput): Promise<Employee>;
}
