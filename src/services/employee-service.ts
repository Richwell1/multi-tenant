// ---------------------------------------------------------------------------
// Employee application service — Zod validation + normalization. Business rules
// (incl. termination) live here, not in the page.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import {
  employeeRepository,
  type CreateEmployeeInput,
  type TerminateEmployeeInput,
  type UpdateEmployeeInput,
} from '@/data/employees';

/** Shared schema — also consumed by the Add Employee form. */
export const employeeFormSchema = z.object({
  employeeNumber: z.string().trim().min(1, 'Employee number is required'),
  fullName: z.string().trim().min(2, 'Full name is required'),
  workEmail: z.string().trim().email('Valid work email required'),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']),
});
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const employeeService = {
  list: (companyId: string) => employeeRepository.list(companyId),

  getById: (companyId: string, id: string) => employeeRepository.getById(companyId, id),

  create: async (companyId: string, input: CreateEmployeeInput) => {
    const parsed = employeeFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid employee', 'validation');
    }
    return employeeRepository.create(companyId, {
      employeeNumber: parsed.data.employeeNumber,
      fullName: parsed.data.fullName,
      workEmail: parsed.data.workEmail.toLowerCase(),
      departmentId: parsed.data.departmentId || undefined,
      positionId: parsed.data.positionId || undefined,
      employmentType: parsed.data.employmentType,
    });
  },

  update: async (companyId: string, id: string, input: UpdateEmployeeInput) =>
    employeeRepository.update(companyId, id, {
      ...input,
      fullName: input.fullName?.trim(),
      workEmail: input.workEmail?.trim().toLowerCase(),
    }),

  terminate: async (companyId: string, id: string, input: TerminateEmployeeInput = {}) =>
    employeeRepository.terminate(companyId, id, { reason: input.reason?.trim() || undefined }),
};
