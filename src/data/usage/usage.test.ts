import { describe, it, expect } from 'vitest';
import { MockUsageRepository } from './mock-usage-repository';
import { usageService } from '@/services/usage-service';
import { queryKeys } from '@/lib/query-keys';

describe('MockUsageRepository', () => {
  const repo = new MockUsageRepository();

  it('returns per-module metrics', async () => {
    const metrics = await repo.list();
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0]).toHaveProperty('module');
    expect(metrics[0]).toHaveProperty('actionCount');
    expect(metrics[0]).toHaveProperty('companiesUsing');
  });
});

describe('usageService', () => {
  it('lists usage metrics', async () => {
    const metrics = await usageService.list({ companyIds: ['alpha'] });
    expect(Array.isArray(metrics)).toBe(true);
  });
});

describe('usage query keys are scoped by company-target', () => {
  it('embed the target selection and differ across scopes', () => {
    const all = queryKeys.usage.summary({ targetMode: 'all_companies', companyIds: [] });
    const one = queryKeys.usage.summary({ targetMode: 'one_company', companyIds: ['alpha'] });
    expect(all).not.toEqual(one);
  });
});
