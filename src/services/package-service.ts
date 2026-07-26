// ---------------------------------------------------------------------------
// Package administration services. Business rules (classification→target
// compatibility, target normalization) live here and reuse the SAME shared
// helpers as the company-target UI — no duplicated rules. The DB RPC enforces
// the same rules server-side (this is fail-fast UX).
// ---------------------------------------------------------------------------

import { RepositoryError } from '@/data/errors';
import {
  createCompanyTargetSchema,
  toCompanyTargetPayload,
  type CompanyTargetValue,
} from '@/lib/company-target';
import { allowedTargetModesForPackageType } from '@/lib/package-target';
import type { PackageType } from '@/data/types';
import {
  installationRepository,
  packageAssignmentRepository,
  packageReleaseRepository,
  packageRepository,
  type InstallationFilters,
} from '@/data/packages';
import type {
  CreatePackageInput,
  CreateVersionInput,
  CreatedPackage,
  PackageVersion,
  ReleasePlanResult,
} from '@/data/packages';

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
const PACKAGE_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const packageService = {
  list: () => packageRepository.list(),
  getByCode: (code: string) => packageRepository.getByCode(code),
  listVersions: (code: string) => packageRepository.listVersions(code),
  createPackage: async (input: CreatePackageInput): Promise<CreatedPackage> => {
    if (!input.name.trim()) throw new RepositoryError('Package name is required.', 'validation');
    if (!PACKAGE_KEY.test(input.code)) throw new RepositoryError('Use a lowercase kebab-case package key.', 'validation');
    if (!SEMVER.test(input.version)) throw new RepositoryError('Enter a valid semantic version.', 'validation');
    if (!input.releaseNotes.trim()) throw new RepositoryError('Release notes are required.', 'validation');
    const baseCode = input.baseCode?.trim() || undefined;
    if (input.classification === 'private_extension' && !baseCode) {
      throw new RepositoryError('Select a base package for the private extension.', 'validation');
    }
    return packageRepository.createPackage({
      ...input,
      name: input.name.trim(),
      releaseNotes: input.releaseNotes.trim(),
      // Only a private extension carries a base package.
      baseCode: input.classification === 'private_extension' ? baseCode : undefined,
    });
  },
  createVersion: async (input: CreateVersionInput): Promise<PackageVersion> => {
    if (!SEMVER.test(input.version)) throw new RepositoryError('Enter a valid semantic version.', 'validation');
    if (!input.releaseNotes.trim()) throw new RepositoryError('Release notes are required.', 'validation');
    return packageRepository.createVersion({ ...input, releaseNotes: input.releaseNotes.trim() });
  },
};

export interface PublishReleaseParams {
  packageVersionId: string;
  classification: PackageType;
  target: CompanyTargetValue;
  automaticInstall: boolean;
}

export const releaseService = {
  getDetails: (id: string) => packageReleaseRepository.getDetails(id),
  /** Validate classification→target compatibility, normalize, then publish. */
  publish: async (params: PublishReleaseParams): Promise<ReleasePlanResult> => {
    if (!params.packageVersionId) {
      throw new RepositoryError('Select a package version to publish.', 'validation');
    }
    const allowedModes = allowedTargetModesForPackageType(params.classification);
    const parsed = createCompanyTargetSchema({ allowedModes }).safeParse(params.target);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid company target', 'validation');
    }
    const payload = toCompanyTargetPayload(params.target);
    const plan = await packageReleaseRepository.createPlan({
      packageVersionId: params.packageVersionId,
      mode: payload.target,
      companyIds: payload.targetCompanyIds,
      automaticInstall: params.automaticInstall,
    });
    if (!params.automaticInstall) return plan;

    const results = await Promise.allSettled(
      plan.installations.map((installation) => packageReleaseRepository.processInstallation(installation.id)),
    );
    return {
      ...plan,
      installations: plan.installations.map((installation, index) => {
        const result = results[index];
        if (result?.status === 'fulfilled') return result.value;
        return {
          ...installation,
          status: 'failed' as const,
          error: 'Installation could not be completed.',
        };
      }),
    };
  },
};

export const assignmentService = {
  listForCompany: (companyId: string) => packageAssignmentRepository.listForCompany(companyId),
};

export const installationService = {
  list: (filters?: InstallationFilters) => installationRepository.list(filters),
  /** Recover a failed installation. RLS/RPC authorize and enforce state server-side. */
  retry: (id: string) => installationRepository.retry(id),
  /** Roll back an installed package (revokes the tenant's entitlement). */
  rollback: (id: string) => installationRepository.rollback(id),
};
