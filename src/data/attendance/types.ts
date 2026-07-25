import type { AttendanceRecord } from '@/data/types';

export type { AttendanceRecord };

export type AttendanceStatus = AttendanceRecord['status'];

export interface CreateAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  /** 'HH:MM'. Required for present/late (the check-in); omitted for absent. */
  checkIn?: string;
  notes?: string;
}

export interface CheckOutAttendanceInput {
  /** 'HH:MM'. Defaults to the current time when omitted. */
  checkOut?: string;
}
