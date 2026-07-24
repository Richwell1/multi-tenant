import { describe, it, expect } from 'vitest';
import { api, forceNextFailure, NetworkError } from './api';

describe('async mock api', () => {
  it('filters employees by tenant', async () => {
    const alpha = await api.getEmployees('alpha');
    const beta = await api.getEmployees('beta');
    expect(alpha.every((e) => e.tenantId === 'alpha')).toBe(true);
    expect(beta.every((e) => e.tenantId === 'beta')).toBe(true);
    expect(alpha.length).toBeGreaterThan(0);
  });

  it('returns cloned data (callers cannot mutate the store)', async () => {
    const first = await api.getCompanies();
    first[0].name = 'MUTATED';
    const second = await api.getCompanies();
    expect(second[0].name).not.toBe('MUTATED');
  });

  it('forceNextFailure makes the next read reject, then a retry succeeds', async () => {
    forceNextFailure('companies');
    await expect(api.getCompanies()).rejects.toBeInstanceOf(NetworkError);
    // retry after the forced failure clears
    await expect(api.getCompanies()).resolves.toBeInstanceOf(Array);
  });

  it('installPackage can be forced to fail then retried', async () => {
    forceNextFailure('install');
    await expect(api.installPackage('attendance-management', 'alpha')).rejects.toBeInstanceOf(NetworkError);
    await expect(api.installPackage('attendance-management', 'alpha')).resolves.toEqual({
      packageKey: 'attendance-management',
      companyId: 'alpha',
    });
  });
});
