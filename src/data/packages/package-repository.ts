import type {
  CompanyPackageAssignment,
  InstallationFilters,
  Package,
  PackageInstallation,
  PackageVersion,
  PublishReleaseInput,
  PublishReleaseResult,
} from './types';

/** Package catalog + versions (platform-plane reads). */
export interface PackageRepository {
  list(): Promise<Package[]>;
  getByCode(code: string): Promise<Package | undefined>;
  listVersions(packageCode: string): Promise<PackageVersion[]>;
}

/** Release publishing — the write path goes through the trusted RPC. */
export interface PackageReleaseRepository {
  publish(input: PublishReleaseInput): Promise<PublishReleaseResult>;
}

/** Per-company package assignments (entitlement state). */
export interface PackageAssignmentRepository {
  listForCompany(companyId: string): Promise<CompanyPackageAssignment[]>;
}

/** Installation monitoring (RLS keeps this tenant-safe). */
export interface InstallationRepository {
  list(filters?: InstallationFilters): Promise<PackageInstallation[]>;
}
