import type { AttendanceRecord, CheckOutAttendanceInput, CreateAttendanceInput } from './types';

/** Company-scoped attendance data access. Entitlement + RLS are the real boundary. */
export interface AttendanceRepository {
  list(companyId: string): Promise<AttendanceRecord[]>;
  create(companyId: string, input: CreateAttendanceInput): Promise<AttendanceRecord>;
  checkOut(companyId: string, id: string, input: CheckOutAttendanceInput): Promise<AttendanceRecord>;
}
