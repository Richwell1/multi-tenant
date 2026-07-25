// ---------------------------------------------------------------------------
// Request application service — Zod validation + the lifecycle transition rule.
// The transition guard mirrors the DB trigger so an illegal pipeline move fails
// fast in the client (and is still rejected by the database if it slips through).
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { canTransition, requestRepository, type RequestStatus } from '@/data/requests';

/** Shared schema — also consumed by the Create Request form. */
export const requestFormSchema = z.object({
  companyId: z.string().min(1, 'Select a company'),
  title: z.string().trim().min(3, 'Title is required'),
  requestType: z.string().trim().min(1, 'Type is required'),
  sourceEmailReference: z.string().trim().min(1, 'Email reference is required'),
  description: z.string().trim().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high']),
});
export type RequestFormValues = z.infer<typeof requestFormSchema>;

export const requestService = {
  list: () => requestRepository.list(),

  getById: (id: string) => requestRepository.getById(id),

  create: async (input: RequestFormValues) => {
    const parsed = requestFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid request', 'validation');
    }
    return requestRepository.create(parsed.data);
  },

  /** Enforce the pipeline state machine before touching the repository. */
  changeStatus: async (id: string, current: RequestStatus, next: RequestStatus) => {
    if (!canTransition(current, next)) {
      throw new RepositoryError(`Cannot move a ${current} request to ${next}`, 'validation');
    }
    return requestRepository.changeStatus(id, next);
  },
};
