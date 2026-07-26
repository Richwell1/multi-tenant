import { resolveDataSource } from '@/data/repository';
import { MockAttendanceRepository } from './mock-attendance-repository';
import type { AttendanceRepository } from './attendance-repository';
import type { CheckOutAttendanceInput, CreateAttendanceInput } from './types';

class LazySupabaseAttendanceRepository implements AttendanceRepository {
  private impl = () => {
    return import('./supabase-attendance-repository').then(
      (m) => new m.SupabaseAttendanceRepository(),
    );
  };
  list = (companyId: string) => {
    return this.impl().then((r) => r.list(companyId));
  };
  create = (companyId: string, input: CreateAttendanceInput) => {
    return this.impl().then((r) => r.create(companyId, input));
  };
  checkOut = (companyId: string, id: string, input: CheckOutAttendanceInput) => {
    return this.impl().then((r) => r.checkOut(companyId, id, input));
  };
}

export function createAttendanceRepository(source = resolveDataSource()): AttendanceRepository {
  return source === 'supabase'
    ? new LazySupabaseAttendanceRepository()
    : new MockAttendanceRepository();
}

export const attendanceRepository: AttendanceRepository = createAttendanceRepository();

export type { AttendanceRepository } from './attendance-repository';
export type {
  AttendanceRecord,
  AttendanceStatus,
  CreateAttendanceInput,
  CheckOutAttendanceInput,
} from './types';
export { attendanceProgress, canCheckOut, totalHoursBetween } from './transitions';
