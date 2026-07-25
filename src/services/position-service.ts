// ---------------------------------------------------------------------------
// Position application service — Zod validation + normalization. Business rules
// live here, not in the page. Same-company department ownership is enforced by
// the database composite FK; this layer validates shape and normalizes input.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import {
  positionRepository,
  type CreatePositionInput,
  type UpdatePositionInput,
} from '@/data/positions';

/** Shared schema — also consumed by the Positions form. */
export const positionFormSchema = z.object({
  title: z.string().trim().min(2, 'Title is required'),
  code: z.string().trim().min(1, 'Code is required'),
  departmentId: z.string().optional(),
  reportsTo: z.string().optional(),
});
export type PositionFormValues = z.infer<typeof positionFormSchema>;

export const positionService = {
  list: (companyId: string) => positionRepository.list(companyId),

  getById: (companyId: string, id: string) => positionRepository.getById(companyId, id),

  create: async (companyId: string, input: CreatePositionInput) => {
    const parsed = positionFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid position', 'validation');
    }
    return positionRepository.create(companyId, {
      title: parsed.data.title,
      code: parsed.data.code.toUpperCase(),
      departmentId: parsed.data.departmentId || undefined,
      reportsTo: parsed.data.reportsTo?.trim() || undefined,
    });
  },

  update: async (companyId: string, id: string, input: UpdatePositionInput) =>
    positionRepository.update(companyId, id, {
      title: input.title?.trim(),
      code: input.code ? input.code.trim().toUpperCase() : undefined,
      departmentId: input.departmentId,
      reportsTo: input.reportsTo?.trim(),
      status: input.status,
    }),

  disable: (companyId: string, id: string) => positionRepository.disable(companyId, id),
};
