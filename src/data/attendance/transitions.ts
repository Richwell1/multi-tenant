import type { AttendanceRecord } from './types';

// Check-in/check-out state machine, mirrored by the DB trigger
// `public.enforce_attendance_transition`:
//   not_checked_in → (check-in) → checked_in → (check-out) → checked_out (terminal)
export type AttendanceProgress = 'not_checked_in' | 'checked_in' | 'checked_out';

export function attendanceProgress(r: Pick<AttendanceRecord, 'checkIn' | 'checkOut'>): AttendanceProgress {
  if (!r.checkIn) return 'not_checked_in';
  return r.checkOut ? 'checked_out' : 'checked_in';
}

/** Only a checked-in (not yet checked-out) record can be checked out. */
export function canCheckOut(r: Pick<AttendanceRecord, 'checkIn' | 'checkOut'>): boolean {
  return attendanceProgress(r) === 'checked_in';
}

/** Whole hours between two 'HH:MM' times, one decimal; 0 when incomplete/invalid. */
export function totalHoursBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const minutes = oh * 60 + om - (ih * 60 + im);
  return minutes > 0 ? Math.round((minutes / 60) * 10) / 10 : 0;
}
