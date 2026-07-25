import { describe, it, expect } from 'vitest';
import {
  MockInstallationRepository,
  MockPackageAssignmentRepository,
  MockPackageReleaseRepository,
  MockPackageRepository,
} from './mock';
import { releaseService } from '@/services/package-service';
import { queryKeys } from '@/lib/query-keys';
import { emptyCompanyTarget } from '@/lib/company-target';

describe('MockPackageRepository', () => {
  const repo = new MockPackageRepository();
  it('lists packages as catalog entries', async () => {
    const list = await repo.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('code');
    expect(list[0]).toHaveProperty('classification');
  });
  it('lists versions for a package', async () => {
    const versions = await repo.listVersions('hr-core');
    expect(versions.every((v) => v.packageCode === 'hr-core')).toBe(true);
  });
});

describe('MockPackageReleaseRepository', () => {
  const repo = new MockPackageReleaseRepository();
  it('all_companies resolves the active company count', async () => {
    const r = await repo.publish({ packageVersionId: 'attendance-management-1.0.0', mode: 'all_companies', companyIds: [], automaticInstall: true });
    expect(r.packageCode).toBe('attendance-management');
    expect(r.version).toBe('1.0.0');
    expect(r.targetCount).toBe(2); // alpha + beta active; gamma suspended
  });
  it('one/selected use the provided company count', async () => {
    const one = await repo.publish({ packageVersionId: 'leave-management-1.0.0', mode: 'one_company', companyIds: ['alpha'], automaticInstall: true });
    expect(one.targetCount).toBe(1);
  });
});

describe('MockInstallationRepository (tenant-scoped filters)', () => {
  const repo = new MockInstallationRepository();
  it('filters by company', async () => {
    const alpha = await repo.list({ companyIds: ['alpha'] });
    expect(alpha.every((i) => i.companyId === 'alpha')).toBe(true);
  });
  it('filters by package code', async () => {
    const rows = await repo.list({ packageCode: 'hr-core' });
    expect(rows.every((i) => i.packageCode === 'hr-core')).toBe(true);
  });
});

describe('MockPackageAssignmentRepository', () => {
  it('returns only the requested company assignments', async () => {
    const repo = new MockPackageAssignmentRepository();
    const alpha = await repo.listForCompany('alpha');
    expect(alpha.every((a) => a.companyId === 'alpha')).toBe(true);
    expect(alpha.map((a) => a.packageCode)).toContain('leave-management');
    const beta = await repo.listForCompany('beta');
    expect(beta.map((a) => a.packageCode)).not.toContain('leave-management');
  });
});

describe('releaseService.publish — classification→target rules', () => {
  it('rejects a private customization targeting all companies', async () => {
    await expect(
      releaseService.publish({
        packageVersionId: 'leave-management-1.0.0',
        classification: 'private_customization',
        target: emptyCompanyTarget('all_companies'),
        automaticInstall: true,
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });

  it('publishes a private customization to exactly one company', async () => {
    const r = await releaseService.publish({
      packageVersionId: 'leave-management-1.0.0',
      classification: 'private_customization',
      target: { mode: 'one_company', companyIds: ['alpha'] },
      automaticInstall: true,
    });
    expect(r.mode).toBe('one_company');
    expect(r.targetCount).toBe(1);
  });

  it('rejects a missing version', async () => {
    await expect(
      releaseService.publish({
        packageVersionId: '',
        classification: 'standard_update',
        target: emptyCompanyTarget('all_companies'),
        automaticInstall: true,
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('package query keys are scoped', () => {
  it('versions + assignments embed their identifiers', () => {
    expect(queryKeys.packages.versions('hr-core')).toEqual(['packages', 'hr-core', 'versions']);
    expect(queryKeys.packageAssignments.company('alpha')).toEqual(['package-assignments', 'alpha']);
    expect(queryKeys.packageAssignments.company('alpha')).not.toEqual(queryKeys.packageAssignments.company('beta'));
  });
});
