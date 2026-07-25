import { describe, it, expect } from 'vitest';
import { MockRequestRepository } from './mock-request-repository';
import { allowedNextStatuses, canTransition, REQUEST_TRANSITIONS } from './transitions';
import { requestService, requestFormSchema } from '@/services/request-service';
import { invalidationTargets } from '@/data/invalidation';
import { queryKeys } from '@/lib/query-keys';

describe('request lifecycle transitions', () => {
  it('follows the delivery pipeline', () => {
    expect(canTransition('received', 'under_review')).toBe(true);
    expect(canTransition('under_review', 'approved')).toBe(true);
    expect(canTransition('approved', 'in_development')).toBe(true);
    expect(canTransition('ready_for_release', 'released')).toBe(true);
  });

  it('rejects pipeline skips and moves out of terminal states', () => {
    expect(canTransition('received', 'released')).toBe(false);
    expect(canTransition('rejected', 'under_review')).toBe(false);
    expect(canTransition('closed', 'received')).toBe(false);
    expect(REQUEST_TRANSITIONS.closed).toHaveLength(0);
  });

  it('allows closing any active request', () => {
    expect(canTransition('received', 'closed')).toBe(true);
    expect(canTransition('in_development', 'closed')).toBe(true);
    expect(allowedNextStatuses('installed')).toContain('closed');
  });
});

describe('MockRequestRepository', () => {
  const repo = new MockRequestRepository();

  it('lists the seeded request records', async () => {
    const all = await repo.list();
    expect(all.length).toBeGreaterThan(0);
  });

  it('create returns a received request', async () => {
    const created = await repo.create({
      companyId: 'alpha',
      title: 'New tool',
      requestType: 'New Package',
      sourceEmailReference: 'EML-9',
      description: 'Please build it',
      priority: 'high',
    });
    expect(created).toMatchObject({ status: 'received', companyId: 'alpha', priority: 'high' });
  });

  it('changeStatus reflects the new status', async () => {
    const updated = await repo.changeStatus('req-1', 'installed');
    expect(updated.status).toBe('installed');
  });
});

describe('requestService', () => {
  const base = {
    companyId: 'alpha',
    title: 'Valid title',
    requestType: 'New Package',
    sourceEmailReference: 'EML-1',
    description: 'A description',
    priority: 'medium' as const,
  };

  it('rejects a too-short title via Zod', async () => {
    await expect(requestService.create({ ...base, title: 'ab' })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('blocks an illegal pipeline transition before the repository', async () => {
    await expect(requestService.changeStatus('req-1', 'received', 'released')).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('allows a legal transition', async () => {
    const res = await requestService.changeStatus('req-1', 'received', 'under_review');
    expect(res.status).toBe('under_review');
  });

  it('form schema requires an email reference', () => {
    expect(requestFormSchema.safeParse({ ...base, sourceEmailReference: '' }).success).toBe(false);
  });
});

describe('request cache invalidation', () => {
  it('status changes refresh the request and audit surfaces', () => {
    const targets = invalidationTargets.changeRequestStatus('req-1');
    expect(targets).toContainEqual(queryKeys.requests.detail('req-1'));
    expect(targets).toContainEqual(queryKeys.audit.all);
  });
});
