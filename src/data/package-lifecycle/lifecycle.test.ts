import { describe, it, expect, beforeEach } from 'vitest';
import { MockPackageLifecycleRepository } from './mock';
import { availableLifecycleActions, lifecycleStatus, type CompanyPackageLifecycle } from './types';

const pkg = (over: Partial<CompanyPackageLifecycle>): CompanyPackageLifecycle => ({
  packageKey: 'document-notes',
  name: 'Document Notes',
  category: 'marketplace_extension',
  installedVersion: '1.0.0',
  enabled: true,
  dataState: 'active',
  retentionUntil: null,
  isMandatory: false,
  installationSource: 'company_marketplace',
  hasFeatureData: true,
  featureStatus: 'implemented',
  ...over,
});

describe('availableLifecycleActions (gating by role + category + state)', () => {
  it('offers disable/uninstall for an active extension to an admin', () => {
    expect(availableLifecycleActions(pkg({}), true)).toEqual(['open', 'disable', 'uninstall']);
  });
  it('offers restore/permanently_remove while retained', () => {
    expect(availableLifecycleActions(pkg({ enabled: false, dataState: 'retained' }), true)).toEqual([
      'restore',
      'permanently_remove',
    ]);
  });
  it('offers enable/uninstall while disabled', () => {
    expect(availableLifecycleActions(pkg({ enabled: false, dataState: 'active' }), true)).toEqual([
      'enable',
      'uninstall',
    ]);
  });
  it('never offers uninstall/remove for a mandatory system package', () => {
    const actions = availableLifecycleActions(pkg({ isMandatory: true, category: 'standard_package' }), true);
    expect(actions).not.toContain('uninstall');
    expect(actions).not.toContain('permanently_remove');
  });
  it('gives a non-admin read-only access', () => {
    expect(availableLifecycleActions(pkg({}), false)).toEqual(['open']);
    expect(availableLifecycleActions(pkg({ enabled: false, dataState: 'retained' }), false)).toEqual([]);
  });
});

describe('lifecycleStatus derivation', () => {
  it('maps entitlement + data state to a status', () => {
    expect(lifecycleStatus(pkg({}))).toBe('active');
    expect(lifecycleStatus(pkg({ enabled: false, dataState: 'active' }))).toBe('disabled');
    expect(lifecycleStatus(pkg({ enabled: false, dataState: 'retained' }))).toBe('uninstalled');
    expect(lifecycleStatus(pkg({ dataState: 'purged' }))).toBe('removed');
  });
});

describe('MockPackageLifecycleRepository transitions', () => {
  const repo = new MockPackageLifecycleRepository();
  beforeEach(() => repo.reset());

  it('disable → enable round-trips without touching data state', async () => {
    await repo.disable('alpha', 'document-notes');
    let rows = await repo.listCompanyPackages('alpha');
    expect(rows.find((r) => r.packageKey === 'document-notes')).toMatchObject({ enabled: false, dataState: 'active' });
    await repo.enable('alpha', 'document-notes');
    rows = await repo.listCompanyPackages('alpha');
    expect(rows.find((r) => r.packageKey === 'document-notes')?.enabled).toBe(true);
  });

  it('uninstall retains for 30 days, restore returns to active', async () => {
    const res = await repo.uninstall('alpha', 'document-notes');
    expect(res.status).toBe('uninstalled');
    let dn = (await repo.listCompanyPackages('alpha')).find((r) => r.packageKey === 'document-notes')!;
    expect(dn.dataState).toBe('retained');
    expect(new Date(dn.retentionUntil!).getTime()).toBeGreaterThan(Date.now());
    await repo.restore('alpha', 'document-notes');
    dn = (await repo.listCompanyPackages('alpha')).find((r) => r.packageKey === 'document-notes')!;
    expect(dn).toMatchObject({ enabled: true, dataState: 'active', retentionUntil: null });
  });

  it('permanently remove requires retention and marks purged', async () => {
    await expect(repo.permanentlyRemove('alpha', 'document-notes')).rejects.toThrow();
    await repo.uninstall('alpha', 'document-notes');
    const res = await repo.permanentlyRemove('alpha', 'document-notes');
    expect(res.status).toBe('purged');
    const dn = (await repo.listCompanyPackages('alpha')).find((r) => r.packageKey === 'document-notes')!;
    expect(dn.dataState).toBe('purged');
  });

  it('mandatory HR Core cannot be uninstalled', async () => {
    await expect(repo.uninstall('alpha', 'hr-core')).rejects.toThrow('cannot be removed');
  });

  it('listOperations returns monitoring metadata only (no tenant content)', async () => {
    const ops = await repo.listOperations();
    expect(ops.length).toBeGreaterThan(0);
    const kinds = ops.map((o) => o.operation);
    expect(kinds).toContain('uninstall');
    expect(kinds).toContain('purge');
    // Metadata only — no note titles or feature rows leak through.
    for (const op of ops) {
      expect(op).toHaveProperty('correlationId');
      expect(op).not.toHaveProperty('notes');
    }
  });
});
