// Company-side Available Updates — pending package updates assigned/released to
// the current company, plus a company-side install. The company is resolved
// server-side from the authenticated membership; RLS/RPC are the boundary.
import { resolveDataSource } from '@/data/repository';
import type { PackageCategory } from '@/lib/packages/category';

export interface AvailableUpdate {
  releaseId: string;
  installationId: string;
  packageKey: string;
  packageName: string;
  category: PackageCategory;
  installedVersion: string | null;
  availableVersion: string;
  basePackageName: string | null;
  releaseNotes: string;
  releasedAt: string | null;
  installationState: string;
  updatePolicy: string;
  automaticInstall: boolean;
}

export interface InstallUpdateResult {
  installationId: string;
  packageKey: string;
  version: string;
}

export interface CompanyUpdatesRepository {
  list(companyId: string): Promise<AvailableUpdate[]>;
  install(installationId: string): Promise<InstallUpdateResult>;
}

// Mock: a small deterministic sample so the badge/page demo works locally.
const MOCK_UPDATES: AvailableUpdate[] = [
  {
    releaseId: 'mock-rel-1',
    installationId: 'mock-inst-1',
    packageKey: 'hr-core',
    packageName: 'HR Core',
    category: 'standard_package',
    installedVersion: '1.0.0',
    availableVersion: '1.1.0',
    basePackageName: null,
    releaseNotes: 'Adds Employees to HR Core.',
    releasedAt: new Date().toISOString(),
    installationState: 'pending',
    updatePolicy: 'company_managed',
    automaticInstall: false,
  },
];

class MockCompanyUpdatesRepository implements CompanyUpdatesRepository {
  private installed = new Set<string>();
  async list(): Promise<AvailableUpdate[]> {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_UPDATES.filter((u) => !this.installed.has(u.installationId));
  }
  async install(installationId: string): Promise<InstallUpdateResult> {
    await new Promise((r) => setTimeout(r, 200));
    this.installed.add(installationId);
    const u = MOCK_UPDATES.find((x) => x.installationId === installationId);
    return { installationId, packageKey: u?.packageKey ?? '', version: u?.availableVersion ?? '' };
  }
}

class LazySupabaseCompanyUpdatesRepository implements CompanyUpdatesRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseCompanyUpdatesRepository());
  // companyId is part of the interface (used for cache keys); the RPC self-scopes.
  list = (_companyId: string) => this.impl().then((r) => r.list());
  install = (installationId: string) => this.impl().then((r) => r.install(installationId));
}

export function createCompanyUpdatesRepository(source = resolveDataSource()): CompanyUpdatesRepository {
  return source === 'supabase' ? new LazySupabaseCompanyUpdatesRepository() : new MockCompanyUpdatesRepository();
}

export const companyUpdatesRepository: CompanyUpdatesRepository = createCompanyUpdatesRepository();
