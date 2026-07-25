import { describe, it, expect } from 'vitest';
import { MockEmployeeRepository } from './mock-employee-repository';
import { employeeService, employeeFormSchema } from '@/services/employee-service';
import { queryKeys } from '@/lib/query-keys';

describe('MockEmployeeRepository', () => {
  const repo = new MockEmployeeRepository();

  it('lists only the requested company (tenant-scoped)', async () => {
    const alpha = await repo.list('alpha');
    const beta = await repo.list('beta');
    expect(alpha.every((e) => e.tenantId === 'alpha')).toBe(true);
    expect(beta.every((e) => e.tenantId === 'beta')).toBe(true);
    expect(alpha.length).toBeGreaterThan(0);
  });

  it('getById cannot cross tenants', async () => {
    const alphaEmp = (await repo.list('alpha'))[0];
    expect(await repo.getById('beta', alphaEmp.id)).toBeUndefined();
  });

  it('create resolves department + position names from the same company', async () => {
    const created = await repo.create('alpha', {
      employeeNumber: 'ALP-100',
      fullName: 'New Hire',
      workEmail: 'new@alpha.test',
      departmentId: 'd1', // Finance (alpha)
      positionId: 'p1', // Accountant (alpha)
      employmentType: 'full_time',
    });
    expect(created).toMatchObject({ tenantId: 'alpha', status: 'active', department: 'Finance', position: 'Accountant' });
  });

  it('terminate sets status to terminated', async () => {
    const emp = (await repo.list('alpha'))[0];
    const result = await repo.terminate('alpha', emp.id, {});
    expect(result.status).toBe('terminated');
  });
});

describe('employeeService', () => {
  const base = { employeeNumber: 'E1', fullName: 'Jane Doe', employmentType: 'full_time' as const };

  it('normalizes and lowercases work email', async () => {
    const e = await employeeService.create('alpha', { ...base, workEmail: '  Jane@ALPHA.Test ' });
    expect(e.workEmail).toBe('jane@alpha.test');
  });

  it('rejects an invalid work email via Zod', async () => {
    await expect(employeeService.create('alpha', { ...base, workEmail: 'not-an-email' })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('rejects a too-short full name', async () => {
    expect(employeeFormSchema.safeParse({ ...base, fullName: 'J', workEmail: 'a@b.co' }).success).toBe(false);
  });
});

describe('employee query keys are tenant-scoped', () => {
  it('embed company id and differ per tenant', () => {
    expect(queryKeys.employees.detail('alpha', 'e1')).toEqual(['employees', 'alpha', 'detail', 'e1']);
    expect(queryKeys.employees.list('alpha')).not.toEqual(queryKeys.employees.list('beta'));
  });
});
