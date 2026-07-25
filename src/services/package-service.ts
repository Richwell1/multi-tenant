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
  type PublishReleaseResult,
} from '@/data/packages';

export const packageService = {
  list: () => packageRepository.list(),
  getByCode: (code: string) => packageRepository.getByCode(code),
  listVersions: (code: string) => packageRepository.listVersions(code),
};

export interface PublishReleaseParams {
  packageVersionId: string;
  classification: PackageType;
  target: CompanyTargetValue;
  automaticInstall: boolean;
}

export const releaseService = {
  /** Validate classification→target compatibility, normalize, then publish. */
  publish: async (params: PublishReleaseParams): Promise<PublishReleaseResult> => {
    if (!params.packageVersionId) {
      throw new RepositoryError('Select a package version to publish.', 'validation');
    }
    const allowedModes = allowedTargetModesForPackageType(params.classification);
    const parsed = createCompanyTargetSchema({ allowedModes }).safeParse(params.target);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid company target', 'validation');
    }
    const payload = toCompanyTargetPayload(params.target);
    return packageReleaseRepository.publish({
      packageVersionId: params.packageVersionId,
      mode: payload.target,
      companyIds: payload.targetCompanyIds,
      automaticInstall: params.automaticInstall,
    });
  },
};

export const assignmentService = {
  listForCompany: (companyId: string) => packageAssignmentRepository.listForCompany(companyId),
};

export const installationService = {
  list: (filters?: InstallationFilters) => installationRepository.list(filters),
};
