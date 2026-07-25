// ---------------------------------------------------------------------------
// Package administration domain models (provider-agnostic). Adapters map DB/mock
// rows into these; components never see raw Supabase rows.
// ---------------------------------------------------------------------------

import type { CompanyTargetMode } from '@/lib/company-target';
import type { PackageType } from '@/data/types';

export type PackageDiagnosticStatus = 'PASS' | 'WARN' | 'FAIL';
export type PackageInstallationStatus =
  | 'pending'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'retrying'
  | 'rolled_back';

export interface Package {
  code: string; // stable identifier (packages.key)
  name: string;
  description: string;
  classification: PackageType;
  isActive: boolean; // global kill switch (packages.is_active)
}

export interface PackageVersion {
  id: string;
  packageCode: string;
  version: string;
  releaseNotes: string;
  diagnosticStatus: PackageDiagnosticStatus | null;
  releasedAt: string | null;
}

export interface PackageInstallation {
  id: string;
  releaseId: string;
  companyId: string;
  companyName: string;
  packageCode: string;
  version: string;
  status: PackageInstallationStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface CompanyPackageAssignment {
  companyId: string;
  packageCode: string;
  packageName: string;
  version: string | null;
  enabled: boolean;
  status: string;
  assignedAt: string | null;
}

export interface PublishReleaseInput {
  packageVersionId: string;
  mode: CompanyTargetMode;
  companyIds: string[];
  automaticInstall: boolean;
}

export interface PublishReleaseResult {
  releaseId: string;
  packageCode: string;
  version: string;
  mode: CompanyTargetMode;
  targetCount: number;
  automaticInstall: boolean;
}

/** Filters for installation monitoring (all optional). */
export interface InstallationFilters {
  companyIds?: string[];
  packageCode?: string;
  status?: PackageInstallationStatus;
}

/** Outcome of a recovery action (retry / rollback). */
export interface InstallationRecoveryResult {
  id: string;
  status: PackageInstallationStatus;
}

/** Only a failed install can be retried; only an installed one can be rolled back. */
export const canRetryInstallation = (status: PackageInstallationStatus): boolean => status === 'failed';
export const canRollbackInstallation = (status: PackageInstallationStatus): boolean => status === 'installed';
