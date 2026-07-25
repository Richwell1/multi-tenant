import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import { totalHoursBetween } from './transitions';
import type { AttendanceRepository } from './attendance-repository';
import type {
  AttendanceRecord,
  AttendanceStatus,
  CheckOutAttendanceInput,
  CreateAttendanceInput,
} from './types';

const COLS =
  'id,company_id,employee_id,attendance_date,check_in_time,check_out_time,status,notes,employees(full_name)';

interface Row {
  id: string;
  company_id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: AttendanceStatus;
  notes: string | null;
  employees: { full_name: string } | null;
}

/** Postgres `time` arrives as 'HH:MM:SS'; the UI shows 'HH:MM'. */
const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

const toDomain = (r: Row): AttendanceRecord => {
  const checkIn = hhmm(r.check_in_time);
  const checkOut = hhmm(r.check_out_time);
  return {
    id: r.id,
    tenantId: r.company_id,
    employeeId: r.employee_id,
    employee: r.employees?.full_name ?? '',
    date: r.attendance_date,
    checkIn,
    checkOut,
    totalHours: totalHoursBetween(checkIn, checkOut),
    status: r.status,
    notes: r.notes ?? undefined,
  };
};

export class SupabaseAttendanceRepository implements AttendanceRepository {
  async list(companyId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .select(COLS)
      .eq('company_id', companyId)
      .order('attendance_date', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateAttendanceInput): Promise<AttendanceRecord> {
    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .insert({
        company_id: companyId,
        employee_id: input.employeeId,
        attendance_date: input.date,
        check_in_time: input.status === 'absent' ? null : (input.checkIn || null),
        status: input.status,
        notes: input.notes || null,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async checkOut(companyId: string, id: string, input: CheckOutAttendanceInput): Promise<AttendanceRecord> {
    // updated_by is stamped server-side from auth.uid() by the enforce trigger.
    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .update({ check_out_time: input.checkOut || null })
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
