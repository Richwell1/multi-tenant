// ---------------------------------------------------------------------------
// Department application service — input normalization + domain validation.
// Business rules live here, never in route components.
// ---------------------------------------------------------------------------

import { RepositoryError } from '@/data/errors';
import {
  departmentRepository,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from '@/data/departments';

const normName = (s: string) => s.trim();
const normCode = (s: string) => s.trim().toUpperCase();

export const departmentService = {
  list: (companyId: string) => departmentRepository.list(companyId),

  getById: (companyId: string, id: string) => departmentRepository.getById(companyId, id),

  create: async (companyId: string, input: CreateDepartmentInput) => {
    const name = normName(input.name);
    // Code is optional (provided by the Custom Department Code Field extension).
    const code = input.code ? normCode(input.code) : undefined;
    if (name.length < 2) throw new RepositoryError('Department name is required.', 'validation');
    return departmentRepository.create(companyId, { name, code, head: input.head?.trim() || undefined });
  },

  update: async (companyId: string, id: string, input: UpdateDepartmentInput) =>
    departmentRepository.update(companyId, id, {
      name: input.name !== undefined ? normName(input.name) : undefined,
      code: input.code !== undefined ? normCode(input.code) : undefined,
      head: input.head?.trim(),
      status: input.status,
    }),

  disable: (companyId: string, id: string) => departmentRepository.disable(companyId, id),
};
