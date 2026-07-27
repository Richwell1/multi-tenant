import { RepositoryError } from '@/data/errors';
import type { PackageCategory } from '@/lib/packages/category';
import type {
  CompanyPackageLifecycle,
  LifecycleOperationRecord,
  LifecycleResult,
  PackageLifecycleRepository,
} from './types';

/** Static catalog metadata for the demo packages (mirrors the DB seed). */
interface CatalogEntry {
  name: string;
  category: PackageCategory;
  isMandatory: boolean;
  hasFeatureData: boolean;
  featureStatus: 'implemented' | 'catalog_only';
}
const CATALOG: Record<string, CatalogEntry> = {
  'hr-core': { name: 'HR Core', category: 'standard_package', isMandatory: true, hasFeatureData: false, featureStatus: 'implemented' },
  'leave-management': { name: 'Leave Management', category: 'standard_package', isMandatory: false, hasFeatureData: false, featureStatus: 'implemented' },
  'attendance-management': { name: 'Attendance Management', category: 'standard_package', isMandatory: false, hasFeatureData: false, featureStatus: 'implemented' },
  'document-notes': { name: 'Document Notes', category: 'marketplace_extension', isMandatory: false, hasFeatureData: true, featureStatus: 'implemented' },
  'expense-requests': { name: 'Expense Requests', category: 'marketplace_extension', isMandatory: false, hasFeatureData: true, featureStatus: 'implemented' },
  'custom-visitor-register': { name: 'Custom Visitor Register', category: 'private_standalone', isMandatory: false, hasFeatureData: true, featureStatus: 'implemented' },
};

/** Default installed set per demo company (keyed by slug === mock companyId). */
const SEED: Record<string, Array<{ key: string; version: string; source: string }>> = {
  alpha: [
    { key: 'hr-core', version: '1.1.0', source: 'registration_default' },
    { key: 'leave-management', version: '1.0.0', source: 'platform_push' },
    { key: 'document-notes', version: '1.0.0', source: 'company_marketplace' },
  ],
  beta: [{ key: 'hr-core', version: '1.0.0', source: 'registration_default' }],
  gamma: [{ key: 'hr-core', version: '1.0.0', source: 'registration_default' }],
};

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function seedFor(companyId: string): CompanyPackageLifecycle[] {
  const rows = SEED[companyId] ?? SEED.alpha;
  return rows.map(({ key, version, source }) => {
    const cat = CATALOG[key] ?? {
      name: key,
      category: 'standard_package' as PackageCategory,
      isMandatory: false,
      hasFeatureData: false,
      featureStatus: 'implemented' as const,
    };
    return {
      packageKey: key,
      name: cat.name,
      category: cat.category,
      installedVersion: version,
      enabled: true,
      dataState: 'active' as const,
      retentionUntil: null,
      isMandatory: cat.isMandatory,
      installationSource: source,
      hasFeatureData: cat.hasFeatureData,
      featureStatus: cat.featureStatus,
    };
  });
}

/**
 * Stateful in-memory lifecycle store so the demo and tests exercise real
 * transitions (disable → enable → uninstall → restore → permanently remove)
 * without a backend. Mirrors the DB RPC rules (mandatory protection, retention).
 */
export class MockPackageLifecycleRepository implements PackageLifecycleRepository {
  private store = new Map<string, CompanyPackageLifecycle[]>();

  /** Reset a company's state (test hygiene). */
  reset(companyId?: string): void {
    if (companyId) this.store.delete(companyId);
    else this.store.clear();
  }

  private rows(companyId: string): CompanyPackageLifecycle[] {
    if (!this.store.has(companyId)) this.store.set(companyId, seedFor(companyId));
    return this.store.get(companyId)!;
  }

  private find(companyId: string, packageKey: string): CompanyPackageLifecycle {
    const row = this.rows(companyId).find((r) => r.packageKey === packageKey);
    if (!row) throw new RepositoryError('That package is not installed.', 'not_found');
    return row;
  }

  async listCompanyPackages(companyId: string): Promise<CompanyPackageLifecycle[]> {
    await new Promise((r) => setTimeout(r, 120));
    return this.rows(companyId).map((r) => ({ ...r }));
  }

  async disable(companyId: string, packageKey: string): Promise<LifecycleResult> {
    const row = this.find(companyId, packageKey);
    if (!row.enabled || row.dataState !== 'active') throw new RepositoryError('That package is not installed.', 'validation');
    row.enabled = false;
    return { packageKey, status: 'disabled' };
  }

  async enable(companyId: string, packageKey: string): Promise<LifecycleResult> {
    const row = this.find(companyId, packageKey);
    if (row.enabled || row.dataState !== 'active') throw new RepositoryError('That package is not disabled.', 'validation');
    row.enabled = true;
    return { packageKey, status: 'enabled' };
  }

  async uninstall(companyId: string, packageKey: string): Promise<LifecycleResult> {
    const row = this.find(companyId, packageKey);
    if (row.isMandatory) throw new RepositoryError('This package cannot be removed.', 'forbidden');
    row.enabled = false;
    row.dataState = 'retained';
    row.retentionUntil = new Date(Date.now() + RETENTION_MS).toISOString();
    return { packageKey, status: 'uninstalled' };
  }

  async restore(companyId: string, packageKey: string): Promise<LifecycleResult> {
    const row = this.find(companyId, packageKey);
    if (row.dataState !== 'retained' && row.dataState !== 'restored') {
      throw new RepositoryError('The retention period has expired.', 'validation');
    }
    row.enabled = true;
    row.dataState = 'active';
    row.retentionUntil = null;
    return { packageKey, status: 'restored' };
  }

  async permanentlyRemove(companyId: string, packageKey: string): Promise<LifecycleResult> {
    const row = this.find(companyId, packageKey);
    if (row.isMandatory) throw new RepositoryError('This package cannot be removed.', 'forbidden');
    if (row.dataState !== 'retained' && row.dataState !== 'restored') {
      throw new RepositoryError('That package is not in retention.', 'validation');
    }
    row.dataState = 'purged';
    row.retentionUntil = null;
    return { packageKey, status: 'purged' };
  }

  async listOperations(): Promise<LifecycleOperationRecord[]> {
    await new Promise((r) => setTimeout(r, 120));
    const now = Date.now();
    const at = (mins: number) => new Date(now - mins * 60000).toISOString();
    return [
      { id: 'op-1', companyName: 'Alpha Trading', packageKey: 'document-notes', packageName: 'Document Notes', operation: 'install', status: 'completed', sourceVersion: null, targetVersion: '1.0.0', diagnosticsStatus: 'PASS', correlationId: 'corr-1', failureReason: null, startedAt: at(120), completedAt: at(120) },
      { id: 'op-2', companyName: 'Alpha Trading', packageKey: 'document-notes', packageName: 'Document Notes', operation: 'uninstall', status: 'completed', sourceVersion: '1.0.0', targetVersion: null, diagnosticsStatus: null, correlationId: 'corr-2', failureReason: null, startedAt: at(60), completedAt: at(60) },
      { id: 'op-3', companyName: 'Alpha Trading', packageKey: 'document-notes', packageName: 'Document Notes', operation: 'restore', status: 'completed', sourceVersion: null, targetVersion: '1.0.0', diagnosticsStatus: null, correlationId: 'corr-3', failureReason: null, startedAt: at(30), completedAt: at(30) },
      { id: 'op-4', companyName: 'Beta Manufacturing', packageKey: 'expense-requests', packageName: 'Expense Requests', operation: 'purge', status: 'completed', sourceVersion: null, targetVersion: null, diagnosticsStatus: null, correlationId: 'corr-4', failureReason: null, startedAt: at(15), completedAt: at(15) },
    ];
  }
}
