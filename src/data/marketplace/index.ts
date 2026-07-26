// Extensions Marketplace — company-facing catalog (list + self-install) and the
// Platform-Admin adoption read. Install/adoption authorize server-side via RPC;
// the company catalog is restricted to marketplace packages by RLS.
import { resolveDataSource } from '@/data/repository';

export interface MarketplacePackage {
  code: string;
  name: string;
  latestVersion: string | null;
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
  { code: 'document-notes', name: 'Document Notes', latestVersion: '1.0.0' },
  { code: 'expense-requests', name: 'Expense Requests', latestVersion: '1.0.0' },
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
