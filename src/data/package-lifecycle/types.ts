// ---------------------------------------------------------------------------
// Package lifecycle domain types (provider-agnostic). Backed by the RPCs in
// migration 20260802010000: disable / enable / uninstall / restore /
// permanently_remove. The company UUID + RLS remain the security boundary.
// ---------------------------------------------------------------------------

import type { PackageCategory } from '@/lib/packages/category';

export type PackageDataState = 'active' | 'retained' | 'restored' | 'pending_purge' | 'purged';

/** UI-facing lifecycle status derived from entitlement + data state. */
export type PackageLifecycleStatus = 'active' | 'disabled' | 'uninstalled' | 'removed';

/** A company's installed package with its lifecycle/retention state. */
export interface CompanyPackageLifecycle {
  packageKey: string;
  name: string;
  category: PackageCategory;
  installedVersion: string | null;
  enabled: boolean;
  dataState: PackageDataState;
  /** ISO date; only set while in the retention window. */
  retentionUntil: string | null;
  isMandatory: boolean;
  installationSource: string | null;
  /** Whether the package owns per-company feature data (drives retention copy). */
  hasFeatureData: boolean;
}

export interface LifecycleResult {
  packageKey: string;
  status: string;
}

export type LifecycleOperationType =
  | 'install' | 'update' | 'rollback' | 'disable' | 'enable'
  | 'uninstall' | 'restore' | 'permanent_removal' | 'purge';
export type LifecycleOperationState = 'running' | 'completed' | 'failed';

/** Platform-Admin monitoring row — operation METADATA only, never tenant content. */
export interface LifecycleOperationRecord {
  id: string;
  companyName: string;
  packageKey: string;
  packageName: string;
  operation: LifecycleOperationType;
  status: LifecycleOperationState;
  sourceVersion: string | null;
  targetVersion: string | null;
  diagnosticsStatus: string | null;
  correlationId: string;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PackageLifecycleRepository {
  /** List the caller's company packages with lifecycle state. */
  listCompanyPackages(companyId: string): Promise<CompanyPackageLifecycle[]>;
  disable(companyId: string, packageKey: string): Promise<LifecycleResult>;
  enable(companyId: string, packageKey: string): Promise<LifecycleResult>;
  uninstall(companyId: string, packageKey: string, reason?: string): Promise<LifecycleResult>;
  restore(companyId: string, packageKey: string): Promise<LifecycleResult>;
  permanentlyRemove(companyId: string, packageKey: string): Promise<LifecycleResult>;
  /** Platform-Admin monitoring: every lifecycle operation (RLS: admin sees all). */
  listOperations(): Promise<LifecycleOperationRecord[]>;
}

/** Actions a company admin may take, given category + role + lifecycle state. */
export type LifecycleAction =
  | 'open'
  | 'disable'
  | 'enable'
  | 'uninstall'
  | 'restore'
  | 'permanently_remove';

/** Pure gating: which actions are valid for a package in its current state. */
export function availableLifecycleActions(
  pkg: CompanyPackageLifecycle,
  isCompanyAdmin: boolean,
): LifecycleAction[] {
  const status = lifecycleStatus(pkg);
  if (status === 'active' && !isCompanyAdmin) return ['open'];
  if (!isCompanyAdmin) return [];

  // Mandatory system packages (HR Core) are never removable by a company.
  if (pkg.isMandatory) return status === 'active' ? ['open'] : [];

  switch (status) {
    case 'active':
      return ['open', 'disable', 'uninstall'];
    case 'disabled':
      return ['enable', 'uninstall'];
    case 'uninstalled':
      return ['restore', 'permanently_remove'];
    case 'removed':
    default:
      return [];
  }
}

/** Derive the UI lifecycle status from entitlement + retention state. */
export function lifecycleStatus(pkg: CompanyPackageLifecycle): PackageLifecycleStatus {
  if (pkg.dataState === 'purged') return 'removed';
  if (pkg.dataState === 'retained' || pkg.dataState === 'pending_purge') return 'uninstalled';
  if (pkg.enabled) return 'active';
  return 'disabled';
}
