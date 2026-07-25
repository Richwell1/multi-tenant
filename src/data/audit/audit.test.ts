import { describe, it, expect } from 'vitest';
import { auditService } from '@/services/audit-service';
import { healthService } from '@/services/health-service';
import { queryKeys } from '@/lib/query-keys';

describe('auditService', () => {
  it('returns audit entries shaped for the platform log', async () => {
    const entries = await auditService.list();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({
      id: expect.any(String),
      timestamp: expect.any(String),
      actor: expect.any(String),
      action: expect.any(String),
      target: expect.any(String),
    });
  });

  it('accepts a company-target filter', async () => {
    const entries = await auditService.list({ companyIds: ['alpha'], limit: 50 });
    expect(Array.isArray(entries)).toBe(true);
  });
});

describe('healthService', () => {
  it('returns health signals with a status tone', async () => {
    const signals = await healthService.list();
    expect(signals.length).toBeGreaterThan(0);
    expect(['healthy', 'degraded', 'offline']).toContain(signals[0].status);
  });
});

describe('audit query keys are scoped by company-target', () => {
  it('embed the target selection', () => {
    const all = queryKeys.audit.list({ targetMode: 'all_companies', companyIds: [] });
    const one = queryKeys.audit.list({ targetMode: 'one_company', companyIds: ['alpha'] });
    expect(all).not.toEqual(one);
  });
});
