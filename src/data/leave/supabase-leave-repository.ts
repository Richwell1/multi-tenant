import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { LeaveRepository } from './leave-repository';
import type {
  CreateLeaveRequestInput,
  DecideLeaveRequestInput,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from './types';

const COLS =
  'id,company_id,employee_id,leave_type,start_date,end_date,status,reason,employees(full_name)';

interface Row {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  reason: string | null;
  employees: { full_name: string } | null;
}

const toDomain = (r: Row): LeaveRequest => ({
  id: r.id,
  tenantId: r.company_id,
  employeeId: r.employee_id,
  employee: r.employees?.full_name ?? '',
  leaveType: r.leave_type,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  reason: r.reason ?? undefined,
});

export class SupabaseLeaveRepository implements LeaveRepository {
  async list(companyId: string): Promise<LeaveRequest[]> {
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .select(COLS)
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .insert({
        company_id: companyId,
        employee_id: input.employeeId,
        leave_type: input.leaveType,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason || null,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async decide(companyId: string, id: string, input: DecideLeaveRequestInput): Promise<LeaveRequest> {
    // reviewed_by / reviewed_at are stamped server-side from auth.uid().
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .update({ status: input.status, review_note: input.reviewNote || null })
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
