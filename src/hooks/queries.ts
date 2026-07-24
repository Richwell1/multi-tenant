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
import { companyMatchesTarget, companyTargetKeyPart, type CompanyTargetValue } from '@/lib/company-target';
import type { Employee, PackageKey, RequestRecord, RequestStatus } from '@/data/types';

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

export const useEmployees = (companyId: string) =>
  useQuery({ queryKey: queryKeys.employees.list(companyId), queryFn: () => repository.getEmployees(companyId) });
export const useEmployee = (companyId: string, employeeId: string) =>
  useQuery({
    queryKey: queryKeys.employees.detail(companyId, employeeId),
    queryFn: () => repository.getEmployee(employeeId),
  });

export const useDepartments = (companyId: string) =>
  useQuery({ queryKey: queryKeys.departments.all(companyId), queryFn: () => repository.getDepartments(companyId) });
export const usePositions = (companyId: string) =>
  useQuery({ queryKey: queryKeys.positions.all(companyId), queryFn: () => repository.getPositions(companyId) });
export const useCompanyUsers = (companyId: string) =>
  useQuery({ queryKey: queryKeys.users.all(companyId), queryFn: () => repository.getCompanyUsers(companyId) });

export const useRequests = () =>
  useQuery({ queryKey: queryKeys.requests.all, queryFn: repository.getRequests });
export const useRequest = (id: string) =>
  useQuery({ queryKey: queryKeys.requests.detail(id), queryFn: () => repository.getRequest(id) });

export const usePackages = () =>
  useQuery({ queryKey: queryKeys.packages.all, queryFn: repository.getPackages });
export const usePackage = (key: string) =>
  useQuery({ queryKey: queryKeys.packages.detail(key), queryFn: () => repository.getPackage(key) });
export const useDiagnostic = (id: string) =>
  useQuery({ queryKey: queryKeys.diagnostics.detail(id), queryFn: () => repository.getDiagnostic(id) });

/** Installation monitoring, filtered by a company-target selection. */
export const useInstallations = (target: CompanyTargetValue) =>
  useQuery({
    queryKey: queryKeys.installations.list(companyTargetKeyPart(target)),
    queryFn: repository.getInstallations,
    select: (rows) => rows.filter((r) => companyMatchesTarget(r.companyId, target)),
  });
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
/** Diagnostics in scope of a company-target selection. */
export const useDiagnostics = (target: CompanyTargetValue) =>
  useQuery({ queryKey: queryKeys.diagnostics.list(companyTargetKeyPart(target)), queryFn: repository.getDiagnostics });

export const useLeaveRequests = (companyId: string) =>
  useQuery({ queryKey: queryKeys.leave.all(companyId), queryFn: () => repository.getLeaveRequests(companyId) });
export const useAttendance = (companyId: string) =>
  useQuery({ queryKey: queryKeys.attendance.all(companyId), queryFn: () => repository.getAttendance(companyId) });

// --- Mutations (scoped invalidation + toasts) --------------------------------

export function useCreateEmployee(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Employee, 'id' | 'status'>) => repository.createEmployee(input),
    onSuccess: () => {
      notify.recordCreated('Employee');
      invalidate(qc, invalidationTargets.createEmployee(companyId));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repository.createRequest,
    onSuccess: () => {
      notify.recordCreated('Request record');
      invalidate(qc, invalidationTargets.createRequest());
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

/** Optimistic: status flips immediately, rolls back on failure. */
export function useChangeRequestStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: RequestStatus) => repository.changeRequestStatus(id, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: queryKeys.requests.detail(id) });
      const previous = qc.getQueryData<RequestRecord>(queryKeys.requests.detail(id));
      if (previous) qc.setQueryData(queryKeys.requests.detail(id), { ...previous, status });
      return { previous };
    },
    onError: (e: NetworkError, _status, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.requests.detail(id), ctx.previous);
      notify.networkFailure(e.message);
    },
    onSuccess: (res) => notify.requestStatusChanged(res.status.replace(/_/g, ' ')),
    onSettled: () => invalidate(qc, invalidationTargets.changeRequestStatus(id)),
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repository.createPackage,
    onSuccess: (_data, variables) => {
      notify.recordCreated('Package release');
      invalidate(qc, invalidationTargets.createPackage());
      // Targeted companies also have their entitlements refreshed — scoped, so
      // untargeted tenants are never touched.
      (variables.targetCompanyIds ?? []).forEach((companyId) =>
        qc.invalidateQueries({ queryKey: queryKeys.packages.company(companyId) }),
      );
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useDisableDepartment(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deptId: string) => repository.disableDepartment(deptId),
    onSuccess: () => {
      notify.recordDisabled('Department');
      invalidate(qc, invalidationTargets.disableDepartment(companyId));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

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
