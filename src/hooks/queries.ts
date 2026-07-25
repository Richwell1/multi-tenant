import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { repository } from '@/data/repository';
import type { NetworkError } from '@/data/api';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import { companyTargetKeyPart, type CompanyTargetValue } from '@/lib/company-target';
import type { PackageKey } from '@/data/types';

/** Invalidate a scoped set of query-key prefixes. */
function invalidate(qc: QueryClient, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

// --- Queries ------------------------------------------------------------------

export const useCompanies = () =>
  useQuery({ queryKey: queryKeys.companies.list(), queryFn: repository.getCompanies });

/**
 * Single centralized source for the active-company list consumed by every
 * company selector/filter across the app. Suspended companies are excluded by
 * default; company records change rarely, so a long stale time is appropriate.
 */
export const useActiveCompanies = () =>
  useQuery({
    queryKey: queryKeys.companies.list({ status: 'active' }),
    queryFn: async () => (await repository.getCompanies()).filter((c) => c.status === 'active'),
    staleTime: 5 * 60_000,
  });

export const useCompany = (id: string) =>
  useQuery({ queryKey: queryKeys.companies.detail(id), queryFn: () => repository.getCompany(id) });

// HR Core (Departments, Positions, Employees) is persisted via dedicated hooks
// in '@/hooks/departments', '@/hooks/positions', '@/hooks/employees'.
export const useCompanyUsers = (companyId: string) =>
  useQuery({ queryKey: queryKeys.users.all(companyId), queryFn: () => repository.getCompanyUsers(companyId) });

// Request Records are persisted via dedicated hooks in '@/hooks/requests'.

// Package catalog, versions, releases, installations, and assignments are
// served by the dedicated '@/hooks/packages' layer (package repositories + RPC).
// Diagnostics are persisted via dedicated hooks in '@/hooks/diagnostics'.

export const useTenantInstallations = (companyId: string) =>
  useQuery({
    queryKey: queryKeys.installations.company(companyId),
    queryFn: () => repository.getInstallationsForTenant(companyId),
  });

/** Usage analytics — selection participates in the cache key. */
export const useUsage = (target: CompanyTargetValue) =>
  useQuery({ queryKey: queryKeys.usage.summary(companyTargetKeyPart(target)), queryFn: repository.getUsage });
export const useHealth = () => useQuery({ queryKey: queryKeys.health.all, queryFn: repository.getHealth });
/** Audit logs — selection participates in the cache key. */
export const useAudit = (target: CompanyTargetValue) =>
  useQuery({ queryKey: queryKeys.audit.list(companyTargetKeyPart(target)), queryFn: repository.getAudit });

// Leave and Attendance are persisted via dedicated hooks in '@/hooks/leave'
// and '@/hooks/attendance'.

// --- Mutations (scoped invalidation + toasts) --------------------------------

export function useSaveSettings(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repository.saveSettings,
    onSuccess: () => {
      notify.recordUpdated('Company settings');
      invalidate(qc, invalidationTargets.saveSettings(companyId));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useAssignPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageKey, companyId }: { packageKey: PackageKey; companyId: string }) =>
      repository.assignPackage(packageKey, companyId),
    onSuccess: (res) => {
      notify.packageAssigned('Package');
      // Scoped to the affected company only — Beta's cache is untouched.
      invalidate(qc, invalidationTargets.assignPackageToCompany(res.companyId));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

/**
 * Installation mutation for the update wizard. Success/error TOASTS are fired by
 * the caller (it also drives the inline installation state machine), but cache
 * invalidation stays centralized here so it can't drift across pages.
 */
export function useInstallPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageKey, companyId }: { packageKey: PackageKey; companyId: string }) =>
      repository.installPackage(packageKey, companyId),
    onSuccess: (res) => invalidate(qc, invalidationTargets.installPackage(res.companyId)),
  });
}
