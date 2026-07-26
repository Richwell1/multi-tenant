import type {
  CompanyPackageAssignment,
  InstallationFilters,
  InstallationRecoveryResult,
  Package,
  PackageInstallation,
  PackageVersion,
  CreatePackageInput,
  CreateVersionInput,
  CreatedPackage,
  PackageReleaseDetails,
  ReleaseInstallationResult,
  ReleasePlanResult,
  PublishReleaseInput,
  PublishReleaseResult,
} from './types';

/** Package catalog + versions (platform-plane reads). */
export interface PackageRepository {
  list(): Promise<Package[]>;
  getByCode(code: string): Promise<Package | undefined>;
  listVersions(packageCode: string): Promise<PackageVersion[]>;
  createPackage(input: CreatePackageInput): Promise<CreatedPackage>;
  createVersion(input: CreateVersionInput): Promise<PackageVersion>;
}

export type { CreatePackageInput, CreateVersionInput, CreatedPackage } from './types';

/** Release publishing — the write path goes through the trusted RPC. */
export interface PackageReleaseRepository {
  publish(input: PublishReleaseInput): Promise<PublishReleaseResult>;
  createPlan(input: PublishReleaseInput): Promise<ReleasePlanResult>;
  processInstallation(id: string): Promise<ReleaseInstallationResult>;
  getDetails(id: string): Promise<PackageReleaseDetails | undefined>;
}

/** Per-company package assignments (entitlement state). */
export interface PackageAssignmentRepository {
  listForCompany(companyId: string): Promise<CompanyPackageAssignment[]>;
}

/**
 * Installation monitoring + recovery. Reads are RLS-tenant-safe; recovery runs
 * through Platform-Admin-only RPCs that also reconcile the company's entitlement.
 */
export interface InstallationRepository {
  list(filters?: InstallationFilters): Promise<PackageInstallation[]>;
  /** Recover a failed installation (re-enables the assignment). */
  retry(id: string): Promise<InstallationRecoveryResult>;
  /** Roll back an installed package (revokes the assignment). */
  rollback(id: string): Promise<InstallationRecoveryResult>;
}
