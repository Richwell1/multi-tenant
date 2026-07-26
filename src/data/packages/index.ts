import { resolveDataSource } from '@/data/repository';
import {
  MockInstallationRepository,
  MockPackageAssignmentRepository,
  MockPackageReleaseRepository,
  MockPackageRepository,
} from './mock';
import type {
  InstallationRepository,
  PackageAssignmentRepository,
  PackageReleaseRepository,
  PackageRepository,
} from './package-repository';
import type { CreatePackageInput, CreateVersionInput, InstallationFilters, PublishReleaseInput } from './types';

const supa = () => import('./supabase');

class LazyPackageRepository implements PackageRepository {
  list() {
    return supa().then((m) => new m.SupabasePackageRepository().list());
  }
  getByCode(code: string) {
    return supa().then((m) => new m.SupabasePackageRepository().getByCode(code));
  }
  listVersions(code: string) {
    return supa().then((m) => new m.SupabasePackageRepository().listVersions(code));
  }
  createPackage(input: CreatePackageInput) {
    return supa().then((m) => new m.SupabasePackageRepository().createPackage(input));
  }
  createVersion(input: CreateVersionInput) {
    return supa().then((m) => new m.SupabasePackageRepository().createVersion(input));
  }
}
class LazyPackageReleaseRepository implements PackageReleaseRepository {
  publish(input: PublishReleaseInput) {
    return supa().then((m) => new m.SupabasePackageReleaseRepository().publish(input));
  }
  createPlan(input: PublishReleaseInput) {
    return supa().then((m) => new m.SupabasePackageReleaseRepository().createPlan(input));
  }
  processInstallation(id: string) {
    return supa().then((m) => new m.SupabasePackageReleaseRepository().processInstallation(id));
  }
  getDetails(id: string) {
    return supa().then((m) => new m.SupabasePackageReleaseRepository().getDetails(id));
  }
}
class LazyPackageAssignmentRepository implements PackageAssignmentRepository {
  listForCompany(companyId: string) {
    return supa().then((m) => new m.SupabasePackageAssignmentRepository().listForCompany(companyId));
  }
}
class LazyInstallationRepository implements InstallationRepository {
  list(filters?: InstallationFilters) {
    return supa().then((m) => new m.SupabaseInstallationRepository().list(filters));
  }
  retry(id: string) {
    return supa().then((m) => new m.SupabaseInstallationRepository().retry(id));
  }
  rollback(id: string) {
    return supa().then((m) => new m.SupabaseInstallationRepository().rollback(id));
  }
}

const isSupabase = (source = resolveDataSource()) => source === 'supabase';

export const packageRepository: PackageRepository = isSupabase()
  ? new LazyPackageRepository()
  : new MockPackageRepository();
export const packageReleaseRepository: PackageReleaseRepository = isSupabase()
  ? new LazyPackageReleaseRepository()
  : new MockPackageReleaseRepository();
export const packageAssignmentRepository: PackageAssignmentRepository = isSupabase()
  ? new LazyPackageAssignmentRepository()
  : new MockPackageAssignmentRepository();
export const installationRepository: InstallationRepository = isSupabase()
  ? new LazyInstallationRepository()
  : new MockInstallationRepository();

export type {
  PackageRepository,
  PackageReleaseRepository,
  PackageAssignmentRepository,
  InstallationRepository,
} from './package-repository';
export type * from './types';
// Value exports (the type-only re-export above would otherwise hide these helpers).
export { canRetryInstallation, canRollbackInstallation } from './types';
