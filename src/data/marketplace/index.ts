// Extensions Marketplace — company-facing catalog (list + self-install) and the
// Platform-Admin adoption read. Install/adoption authorize server-side via RPC;
// the company catalog is restricted to marketplace packages by RLS.
import { resolveDataSource } from '@/data/repository';

/** Honest implementation readiness (separate from diagnostics PASS). */
export type FeatureStatus = 'implemented' | 'catalog_only';

export interface MarketplacePackage {
  code: string;
  name: string;
  description: string;
  latestVersion: string | null;
  /** 'catalog_only' = discovery/review/lifecycle only; feature build pending. */
  featureStatus: FeatureStatus;
}

export interface MarketplaceInstallResult {
  packageKey: string;
  version: string;
}

export interface AdoptionRow {
  packageKey: string;
  packageName: string;
  installCount: number;
  distinctCompanies: number;
}

export interface MarketplaceRepository {
  list(): Promise<MarketplacePackage[]>;
  install(packageKey: string): Promise<MarketplaceInstallResult>;
  adoption(): Promise<AdoptionRow[]>;
}

const MOCK_CATALOG: MarketplacePackage[] = [
  { code: 'document-notes', name: 'Document Notes', description: 'Create simple internal notes for your company.', latestVersion: '1.0.0', featureStatus: 'implemented' },
  { code: 'expense-requests', name: 'Expense Requests', description: 'Record and track basic company expense requests.', latestVersion: '1.0.0', featureStatus: 'implemented' },
  { code: 'company-announcements', name: 'Company Announcements', description: 'Broadcast company-wide announcements to your workspace.', latestVersion: '1.0.0', featureStatus: 'implemented' },
  { code: 'asset-register', name: 'Asset Register', description: 'Track company assets and who they are assigned to.', latestVersion: '1.0.0', featureStatus: 'implemented' },
  { code: 'pulse-surveys', name: 'Pulse Surveys', description: 'Run short, recurring employee pulse surveys.', latestVersion: '1.0.0', featureStatus: 'catalog_only' },
];

class MockMarketplaceRepository implements MarketplaceRepository {
  async list(): Promise<MarketplacePackage[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...MOCK_CATALOG];
  }
  async install(packageKey: string): Promise<MarketplaceInstallResult> {
    await new Promise((r) => setTimeout(r, 200));
    return { packageKey, version: '1.0.0' };
  }
  async adoption(): Promise<AdoptionRow[]> {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_CATALOG.map((p) => ({ packageKey: p.code, packageName: p.name, installCount: 0, distinctCompanies: 0 }));
  }
}

class LazySupabaseMarketplaceRepository implements MarketplaceRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseMarketplaceRepository());
  list = () => this.impl().then((r) => r.list());
  install = (packageKey: string) => this.impl().then((r) => r.install(packageKey));
  adoption = () => this.impl().then((r) => r.adoption());
}

export function createMarketplaceRepository(source = resolveDataSource()): MarketplaceRepository {
  return source === 'supabase' ? new LazySupabaseMarketplaceRepository() : new MockMarketplaceRepository();
}

export const marketplaceRepository: MarketplaceRepository = createMarketplaceRepository();
