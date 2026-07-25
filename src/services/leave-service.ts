// ---------------------------------------------------------------------------
// Leave application service — Zod validation + the status-transition rule.
// The transition guard mirrors the DB trigger so an illegal decision fails fast
// in the client (and is still rejected by the database if it slips through).
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import {
  canTransition,
  leaveRepository,
  type DecideLeaveRequestInput,
  type LeaveStatus,
} from '@/data/leave';

/** Shared schema — also consumed by the Add Request form. */
export const leaveRequestFormSchema = z
  .object({
    employeeId: z.string().trim().min(1, 'Employee is required'),
    leaveType: z.enum(['annual', 'sick', 'unpaid']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type LeaveRequestFormValues = z.infer<typeof leaveRequestFormSchema>;

export const leaveService = {
  list: (companyId: string) => leaveRepository.list(companyId),

  create: async (companyId: string, input: LeaveRequestFormValues) => {
    const parsed = leaveRequestFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid leave request', 'validation');
    }
    return leaveRepository.create(companyId, {
      employeeId: parsed.data.employeeId,
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason?.trim() || undefined,
    });
  },

  /** Enforce the status machine before touching the repository. */
  decide: async (
    companyId: string,
    id: string,
    current: LeaveStatus,
    input: DecideLeaveRequestInput,
  ) => {
    if (!canTransition(current, input.status)) {
      throw new RepositoryError(
        `Cannot change a ${current} request to ${input.status}`,
        'validation',
      );
    }
    return leaveRepository.decide(companyId, id, {
      status: input.status,
      reviewNote: input.reviewNote?.trim() || undefined,
    });
  },
};
