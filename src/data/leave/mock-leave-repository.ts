import { employees, leaveRequests } from '@/data/mock';
import type { LeaveRepository } from './leave-repository';
import type { CreateLeaveRequestInput, DecideLeaveRequestInput, LeaveRequest } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

const employeeName = (companyId: string, id: string) =>
  employees.find((e) => e.tenantId === companyId && e.id === id)?.fullName ?? '';

/** Mock adapter — reads the static seed; mutations are simulated (no persistence). */
export class MockLeaveRepository implements LeaveRepository {
  async list(companyId: string): Promise<LeaveRequest[]> {
    await delay();
    return clone(leaveRequests.filter((l) => l.tenantId === companyId));
  }

  async create(companyId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    await delay();
    return {
      id: `l-${Date.now()}`,
      tenantId: companyId,
      employeeId: input.employeeId,
      employee: employeeName(companyId, input.employeeId),
      leaveType: input.leaveType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'pending',
      reason: input.reason,
    };
  }

  async decide(companyId: string, id: string, input: DecideLeaveRequestInput): Promise<LeaveRequest> {
    await delay();
    const l = leaveRequests.find((x) => x.tenantId === companyId && x.id === id);
    return {
      id,
      tenantId: companyId,
      employeeId: l?.employeeId ?? '',
      employee: l?.employee ?? '',
      leaveType: l?.leaveType ?? 'annual',
      startDate: l?.startDate ?? '',
      endDate: l?.endDate ?? '',
      status: input.status,
      reason: l?.reason,
    };
  }
}
