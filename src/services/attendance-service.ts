// ---------------------------------------------------------------------------
// Attendance application service — Zod validation, the check-in/check-out state
// rule, and same-day duplicate prevention (also enforced by the DB). Business
// rules live here, not in the page.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import {
  attendanceRepository,
  canCheckOut,
  type AttendanceRecord,
  type CheckOutAttendanceInput,
} from '@/data/attendance';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Shared schema — also consumed by the Add Attendance form. */
export const attendanceFormSchema = z
  .object({
    employeeId: z.string().trim().min(1, 'Employee is required'),
    date: z.string().min(1, 'Date is required'),
    status: z.enum(['present', 'late', 'absent']),
    checkIn: z.string().regex(TIME_RE, 'Use HH:MM').optional().or(z.literal('')),
    notes: z.string().trim().max(500).optional(),
  })
  // Present/late means the employee was here — a check-in time is required.
  .refine((v) => v.status === 'absent' || !!v.checkIn, {
    message: 'Check-in time is required unless the employee is absent',
    path: ['checkIn'],
  });
export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

/** Current local time as 'HH:MM' — the default check-out moment. */
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

export const attendanceService = {
  list: (companyId: string) => attendanceRepository.list(companyId),

  create: async (companyId: string, input: AttendanceFormValues) => {
    const parsed = attendanceFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid attendance', 'validation');
    }
    return attendanceRepository.create(companyId, {
      employeeId: parsed.data.employeeId,
      date: parsed.data.date,
      status: parsed.data.status,
      checkIn: parsed.data.status === 'absent' ? undefined : parsed.data.checkIn || undefined,
      notes: parsed.data.notes?.trim() || undefined,
    });
  },

  /** Enforce the state rule (and check-out ≥ check-in) before touching the repo. */
  checkOut: async (
    companyId: string,
    id: string,
    current: AttendanceRecord,
    input: CheckOutAttendanceInput = {},
  ) => {
    if (!canCheckOut(current)) {
      throw new RepositoryError('This record cannot be checked out', 'validation');
    }
    const checkOut = input.checkOut || nowHHMM();
    if (checkOut < current.checkIn) {
      throw new RepositoryError('Check-out cannot be earlier than check-in', 'validation');
    }
    return attendanceRepository.checkOut(companyId, id, { checkOut });
  },
};
