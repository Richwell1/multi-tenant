import type { LeaveRequest } from '@/data/types';

export type { LeaveRequest };

export type LeaveType = LeaveRequest['leaveType'];
export type LeaveStatus = LeaveRequest['status'];
/** The terminal decisions a pending request can move to. */
export type LeaveDecision = Exclude<LeaveStatus, 'pending'>;

export interface CreateLeaveRequestInput {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface DecideLeaveRequestInput {
  status: LeaveDecision;
  reviewNote?: string;
}
