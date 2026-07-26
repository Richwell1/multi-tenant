import { describe, it, expect } from 'vitest';
import {
  MockInstallationRepository,
  MockPackageAssignmentRepository,
  MockPackageReleaseRepository,
  MockPackageRepository,
} from './mock';
import { packageService, releaseService } from '@/services/package-service';
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
  it('creates a package and first version through one provider-independent input', async () => {
    const result = await repo.createPackage({
      code: 'quality-demo',
      name: 'Quality Demo',
      classification: 'standard_update',
      description: 'Demo package',
      version: '1.0.0',
      releaseNotes: 'Initial release',
    });
    expect(result.package.code).toBe('quality-demo');
    expect(result.version.version).toBe('1.0.0');
  });
  it('creates a version without publishing or assigning it', async () => {
    const version = await repo.createVersion({
      packageCode: 'quality-demo',
      version: '1.1.0',
      releaseNotes: 'Follow-up release',
      compatibilityNotes: 'Backward compatible',
    });
    expect(version.releasedAt).toBeNull();
    expect(version.compatibilityNotes).toBe('Backward compatible');
  });
});

describe('packageService validation', () => {
  it('rejects invalid package keys, versions, and empty release notes', async () => {
    await expect(packageService.createPackage({ code: 'Not Valid', name: 'Demo', classification: 'standard_update', description: '', version: '1.0.0', releaseNotes: 'notes' })).rejects.toMatchObject({ kind: 'validation' });
    await expect(packageService.createPackage({ code: 'valid-key', name: 'Demo', classification: 'standard_update', description: '', version: '1.0', releaseNotes: 'notes' })).rejects.toMatchObject({ kind: 'validation' });
    await expect(packageService.createPackage({ code: 'valid-key', name: 'Demo', classification: 'standard_update', description: '', version: '1.0.0', releaseNotes: ' ' })).rejects.toMatchObject({ kind: 'validation' });
  });

  it('rejects a private extension created without a base package', async () => {
    await expect(
      packageService.createPackage({ code: 'ext-no-base', name: 'Ext', classification: 'private_extension', description: '', version: '1.0.0', releaseNotes: 'notes' }),
    ).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('MockPackageRepository — private extension base package', () => {
  const repo = new MockPackageRepository();
  it('requires an existing, active base package', async () => {
    await expect(
      repo.createPackage({ code: 'ext-missing-base', name: 'Ext', classification: 'private_extension', description: '', version: '1.0.0', releaseNotes: 'notes', baseCode: 'does-not-exist' }),
    ).rejects.toMatchObject({ kind: 'not_found' });
  });
  it('creates a private extension when the base package exists', async () => {
    const result = await repo.createPackage({ code: 'alpha-approval', name: 'Alpha Approval', classification: 'private_extension', description: '', version: '1.0.0', releaseNotes: 'notes', baseCode: 'hr-core' });
    expect(result.package.classification).toBe('private_extension');
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
  it('keeps per-company processing independent when one installation fails', async () => {
    const repo = new MockPackageReleaseRepository(new Set(['beta']));
    const plan = await repo.createPlan({ packageVersionId: 'attendance-management-1.0.0', mode: 'selected_companies', companyIds: ['alpha', 'beta'], automaticInstall: true });
    const results = await Promise.all(plan.installations.map((installation) => repo.processInstallation(installation.id)));
    expect(results.find((result) => result.companyId === 'alpha')?.status).toBe('installed');
    expect(results.find((result) => result.companyId === 'beta')?.status).toBe('failed');
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
