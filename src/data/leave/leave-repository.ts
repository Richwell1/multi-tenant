import type {
  CreateLeaveRequestInput,
  DecideLeaveRequestInput,
  LeaveRequest,
} from './types';

/** Company-scoped leave data access. Entitlement + RLS are the real boundary. */
export interface LeaveRepository {
  list(companyId: string): Promise<LeaveRequest[]>;
  create(companyId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest>;
  decide(companyId: string, id: string, input: DecideLeaveRequestInput): Promise<LeaveRequest>;
}
