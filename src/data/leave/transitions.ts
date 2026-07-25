import type { LeaveStatus } from './types';

// Single source of truth for the leave status machine, mirrored by the DB
// trigger `public.enforce_leave_transition`. A pending request can be approved,
// rejected, or cancelled; every other state is terminal.
export const LEAVE_TRANSITIONS: Readonly<Record<LeaveStatus, readonly LeaveStatus[]>> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: LeaveStatus, to: LeaveStatus): boolean {
  return LEAVE_TRANSITIONS[from].includes(to);
}
