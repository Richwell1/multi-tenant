import { resolveDataSource } from '@/data/repository';
import { MockLeaveRepository } from './mock-leave-repository';
import type { LeaveRepository } from './leave-repository';
import type { CreateLeaveRequestInput, DecideLeaveRequestInput } from './types';

class LazySupabaseLeaveRepository implements LeaveRepository {
  private impl() {
    return import('./supabase-leave-repository').then((m) => new m.SupabaseLeaveRepository());
  }
  list(companyId: string) {
    return this.impl().then((r) => r.list(companyId));
  }
  create(companyId: string, input: CreateLeaveRequestInput) {
    return this.impl().then((r) => r.create(companyId, input));
  }
  decide(companyId: string, id: string, input: DecideLeaveRequestInput) {
    return this.impl().then((r) => r.decide(companyId, id, input));
  }
}

export function createLeaveRepository(source = resolveDataSource()): LeaveRepository {
  return source === 'supabase' ? new LazySupabaseLeaveRepository() : new MockLeaveRepository();
}

export const leaveRepository: LeaveRepository = createLeaveRepository();

export type { LeaveRepository } from './leave-repository';
export type {
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  LeaveDecision,
  CreateLeaveRequestInput,
  DecideLeaveRequestInput,
} from './types';
export { LEAVE_TRANSITIONS, canTransition } from './transitions';
