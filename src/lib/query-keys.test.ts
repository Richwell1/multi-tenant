import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

describe('query-key factory — tenant isolation', () => {
  it('employee keys embed the company id and are distinct per tenant', () => {
    const alpha = queryKeys.employees.list('alpha');
    const beta = queryKeys.employees.list('beta');
    expect(alpha).not.toEqual(beta);
    expect(alpha[1]).toBe('alpha');
    expect(beta[1]).toBe('beta');
  });

  it('package entitlement keys are per-company', () => {
    expect(queryKeys.packages.company('alpha')).toEqual(['packages', 'company', 'alpha']);
    expect(queryKeys.packages.company('beta')).toEqual(['packages', 'company', 'beta']);
  });

  it('Alpha and Beta employee caches never collide in a real QueryClient', () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.employees.list('alpha'), [{ id: 'a1' }]);
    qc.setQueryData(queryKeys.employees.list('beta'), [{ id: 'b1' }]);

    expect(qc.getQueryData(queryKeys.employees.list('alpha'))).toEqual([{ id: 'a1' }]);
    expect(qc.getQueryData(queryKeys.employees.list('beta'))).toEqual([{ id: 'b1' }]);

    // Removing Alpha's tenant-scoped cache leaves Beta intact.
    qc.removeQueries({ queryKey: queryKeys.employees.all('alpha') });
    expect(qc.getQueryData(queryKeys.employees.list('alpha'))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.employees.list('beta'))).toEqual([{ id: 'b1' }]);
  });

  it('invalidating Alpha packages does not match Beta package keys', () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.packages.company('alpha'), ['leave-management']);
    qc.setQueryData(queryKeys.packages.company('beta'), []);

    qc.removeQueries({ queryKey: queryKeys.packages.company('alpha') });
    expect(qc.getQueryData(queryKeys.packages.company('alpha'))).toBeUndefined();
    // Beta entitlements untouched — Alpha's Leave assignment cannot leak.
    expect(qc.getQueryData(queryKeys.packages.company('beta'))).toEqual([]);
  });
});

describe('company-target participates in filter query keys', () => {
  const part = { targetMode: 'selected_companies' as const, companyIds: ['alpha', 'beta'] };

  it('installation / usage / audit / diagnostic keys embed the target part', () => {
    expect(queryKeys.installations.list(part)).toEqual(['installations', 'list', part]);
    expect(queryKeys.usage.summary(part)).toEqual(['usage', 'summary', part]);
    expect(queryKeys.audit.list(part)).toEqual(['audit', 'list', part]);
    expect(queryKeys.diagnostics.list(part)).toEqual(['diagnostics', 'list', part]);
  });

  it('different selections produce different cache keys', () => {
    const one = queryKeys.usage.summary({ targetMode: 'one_company', companyIds: ['alpha'] });
    const all = queryKeys.usage.summary({ targetMode: 'all_companies', companyIds: [] });
    expect(one).not.toEqual(all);
  });
});
