import { describe, it, expect } from 'vitest';
import { MockLeaveRepository } from './mock-leave-repository';
import { canTransition, LEAVE_TRANSITIONS } from './transitions';
import { leaveService, leaveRequestFormSchema } from '@/services/leave-service';
import { invalidationTargets } from '@/data/invalidation';
import { queryKeys } from '@/lib/query-keys';

describe('leave status transitions', () => {
  it('allows pending → approved/rejected/cancelled only', () => {
    expect(canTransition('pending', 'approved')).toBe(true);
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('treats approved/rejected/cancelled as terminal', () => {
    expect(canTransition('approved', 'rejected')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(canTransition('cancelled', 'approved')).toBe(false);
    expect(LEAVE_TRANSITIONS.approved).toHaveLength(0);
  });
});

describe('MockLeaveRepository', () => {
  const repo = new MockLeaveRepository();

  it('lists only the requested company (tenant-scoped)', async () => {
    const alpha = await repo.list('alpha');
    const beta = await repo.list('beta');
    expect(alpha.every((l) => l.tenantId === 'alpha')).toBe(true);
    expect(beta.every((l) => l.tenantId === 'beta')).toBe(true);
    expect(alpha.length).toBeGreaterThan(0);
  });

  it('create resolves the employee name from the same company and starts pending', async () => {
    const created = await repo.create('alpha', {
      employeeId: 'e1', // Maria Santos (alpha)
      leaveType: 'annual',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    });
    expect(created).toMatchObject({ tenantId: 'alpha', status: 'pending', employee: 'Maria Santos' });
  });
});

describe('leaveService', () => {
  const base = {
    employeeId: 'e1',
    leaveType: 'annual' as const,
    startDate: '2026-09-01',
    endDate: '2026-09-05',
  };

  it('rejects an end date before the start date', async () => {
    await expect(
      leaveService.create('alpha', { ...base, startDate: '2026-09-05', endDate: '2026-09-01' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('rejects a missing employee via Zod', () => {
    expect(leaveRequestFormSchema.safeParse({ ...base, employeeId: '' }).success).toBe(false);
  });

  it('blocks an illegal status transition before hitting the repository', async () => {
    await expect(
      leaveService.decide('alpha', 'l1', 'approved', { status: 'rejected' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('allows a legal decision from pending', async () => {
    const res = await leaveService.decide('alpha', 'l2', 'pending', { status: 'approved' });
    expect(res.status).toBe('approved');
  });
});

describe('leave cache invalidation is tenant-scoped', () => {
  it('embeds company id and never targets another tenant', () => {
    const targets = invalidationTargets.createLeaveRequest('alpha');
    expect(targets).toContainEqual(queryKeys.leave.all('alpha'));
    expect(targets).not.toContainEqual(queryKeys.leave.all('beta'));
  });
});
