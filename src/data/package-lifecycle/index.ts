// ---------------------------------------------------------------------------
// Package lifecycle factory — mock by default; Supabase adapter lazily loaded
// (SDK out of the default bundle) when VITE_DATA_SOURCE=supabase.
// ---------------------------------------------------------------------------

import { resolveDataSource } from '@/data/repository';
import { MockPackageLifecycleRepository } from './mock';
import type {
  CompanyPackageLifecycle,
  LifecycleResult,
  PackageLifecycleRepository,
} from './types';

class LazyPackageLifecycleRepository implements PackageLifecycleRepository {
  private load() {
    return import('./supabase').then((m) => new m.SupabasePackageLifecycleRepository());
  }
  listCompanyPackages(companyId: string): Promise<CompanyPackageLifecycle[]> {
    return this.load().then((r) => r.listCompanyPackages(companyId));
  }
  disable(companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.load().then((r) => r.disable(companyId, packageKey));
  }
  enable(companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.load().then((r) => r.enable(companyId, packageKey));
  }
  uninstall(companyId: string, packageKey: string, reason?: string): Promise<LifecycleResult> {
    return this.load().then((r) => r.uninstall(companyId, packageKey, reason));
  }
  restore(companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.load().then((r) => r.restore(companyId, packageKey));
  }
  permanentlyRemove(companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.load().then((r) => r.permanentlyRemove(companyId, packageKey));
  }
}

export function createPackageLifecycleRepository(source = resolveDataSource()): PackageLifecycleRepository {
  return source === 'supabase' ? new LazyPackageLifecycleRepository() : new MockPackageLifecycleRepository();
}

export const packageLifecycleRepository = createPackageLifecycleRepository();

export type {
  CompanyPackageLifecycle,
  LifecycleResult,
  PackageLifecycleRepository,
  PackageDataState,
  PackageLifecycleStatus,
  LifecycleAction,
} from './types';
export { availableLifecycleActions, lifecycleStatus } from './types';
