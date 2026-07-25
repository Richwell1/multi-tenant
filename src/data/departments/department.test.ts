import { describe, it, expect } from 'vitest';
import { MockDepartmentRepository } from './mock-department-repository';
import { departmentService } from '@/services/department-service';
import { RepositoryError } from '@/data/errors';

describe('MockDepartmentRepository', () => {
  const repo = new MockDepartmentRepository();

  it('lists only the requested company (tenant-scoped)', async () => {
    const alpha = await repo.list('alpha');
    const beta = await repo.list('beta');
    expect(alpha.every((d) => d.tenantId === 'alpha')).toBe(true);
    expect(beta.every((d) => d.tenantId === 'beta')).toBe(true);
    expect(alpha.length).toBeGreaterThan(0);
  });

  it('create returns a domain department scoped to the company', async () => {
    const d = await repo.create('alpha', { name: 'Legal', code: 'LEG' });
    expect(d).toMatchObject({ tenantId: 'alpha', name: 'Legal', code: 'LEG', status: 'active' });
  });
});

describe('departmentService', () => {
  it('normalizes name (trim) and code (uppercase)', async () => {
    const d = await departmentService.create('alpha', { name: '  Finance  ', code: 'fin ' });
    expect(d.name).toBe('Finance');
    expect(d.code).toBe('FIN');
  });

  it('rejects a too-short name', async () => {
    await expect(departmentService.create('alpha', { name: 'X', code: 'X' })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('rejects an empty code', async () => {
    await expect(departmentService.create('alpha', { name: 'Valid', code: '   ' })).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});
