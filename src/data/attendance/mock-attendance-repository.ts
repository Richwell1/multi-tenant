import { attendanceRecords, employees } from '@/data/mock';
import { RepositoryError } from '@/data/errors';
import { canCheckOut, totalHoursBetween } from './transitions';
import type { AttendanceRepository } from './attendance-repository';
import type { AttendanceRecord, CheckOutAttendanceInput, CreateAttendanceInput } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

const employeeName = (companyId: string, id: string) =>
  employees.find((e) => e.tenantId === companyId && e.id === id)?.fullName ?? '';

/**
 * Mock adapter — stateful within a session so the same-day uniqueness and the
 * check-out transition (which the DB enforces on the Supabase path) stay
 * observable in mock mode and in tests. Seeded from the static mock rows.
 */
export class MockAttendanceRepository implements AttendanceRepository {
  private store: AttendanceRecord[] = clone(attendanceRecords);

  async list(companyId: string): Promise<AttendanceRecord[]> {
    await delay();
    return clone(this.store.filter((a) => a.tenantId === companyId));
  }

  async create(companyId: string, input: CreateAttendanceInput): Promise<AttendanceRecord> {
    await delay();
    const duplicate = this.store.some(
      (a) => a.tenantId === companyId && a.employeeId === input.employeeId && a.date === input.date,
    );
    if (duplicate) {
      throw new RepositoryError('Attendance already recorded for this employee and date', 'conflict');
    }
    const checkIn = input.status === 'absent' ? '' : (input.checkIn ?? '');
    const record: AttendanceRecord = {
      id: `at-${Date.now()}`,
      tenantId: companyId,
      employeeId: input.employeeId,
      employee: employeeName(companyId, input.employeeId),
      date: input.date,
      checkIn,
      checkOut: '',
      totalHours: 0,
      status: input.status,
      notes: input.notes,
    };
    this.store.push(record);
    return clone(record);
  }

  async checkOut(companyId: string, id: string, input: CheckOutAttendanceInput): Promise<AttendanceRecord> {
    await delay();
    const record = this.store.find((a) => a.tenantId === companyId && a.id === id);
    if (!record) throw new RepositoryError('Attendance record not found', 'not_found');
    if (!canCheckOut(record)) {
      throw new RepositoryError('Record is not checked in or already checked out', 'conflict');
    }
    const checkOut = input.checkOut ?? '';
    record.checkOut = checkOut;
    record.totalHours = totalHoursBetween(record.checkIn, checkOut);
    return clone(record);
  }
}
