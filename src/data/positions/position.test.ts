import { describe, it, expect } from 'vitest';
import { MockPositionRepository } from './mock-position-repository';
import { positionService, positionFormSchema } from '@/services/position-service';
import { queryKeys } from '@/lib/query-keys';

describe('MockPositionRepository', () => {
  const repo = new MockPositionRepository();

  it('lists only the requested company (tenant-scoped)', async () => {
    const alpha = await repo.list('alpha');
    const beta = await repo.list('beta');
    expect(alpha.every((p) => p.tenantId === 'alpha')).toBe(true);
    expect(beta.every((p) => p.tenantId === 'beta')).toBe(true);
    expect(alpha.length).toBeGreaterThan(0);
  });

  it('create resolves the department name from the same company', async () => {
    // 'p1' seed uses department Finance (id d1) for alpha
    const created = await repo.create('alpha', { title: 'Lead', code: 'LED', departmentId: 'd1' });
    expect(created).toMatchObject({ tenantId: 'alpha', title: 'Lead', code: 'LED', status: 'active' });
    expect(created.department).toBe('Finance');
  });

  it('create with unknown/other-company department yields empty name (mock)', async () => {
    const created = await repo.create('alpha', { title: 'X', code: 'X', departmentId: 'd4' }); // d4 is Beta's
    expect(created.department).toBe('');
  });
});

describe('positionService', () => {
  it('normalizes title (trim) and code (uppercase)', async () => {
    const p = await positionService.create('alpha', { title: '  Analyst  ', code: 'ana' });
    expect(p.title).toBe('Analyst');
    expect(p.code).toBe('ANA');
  });

  it('rejects an empty title via Zod', async () => {
    await expect(positionService.create('alpha', { title: '', code: 'C' })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('form schema requires title and code', () => {
    expect(positionFormSchema.safeParse({ title: 'Ok', code: 'OK' }).success).toBe(true);
    expect(positionFormSchema.safeParse({ title: 'A', code: '' }).success).toBe(false);
  });
});

describe('position query keys are tenant-scoped', () => {
  it('embed the company id and differ per tenant', () => {
    expect(queryKeys.positions.all('alpha')).toEqual(['positions', 'alpha']);
    expect(queryKeys.positions.detail('alpha', 'p1')).toEqual(['positions', 'alpha', 'detail', 'p1']);
    expect(queryKeys.positions.all('alpha')).not.toEqual(queryKeys.positions.all('beta'));
  });
});
