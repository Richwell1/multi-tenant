import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  assignmentService,
  installationService,
  packageService,
  releaseService,
  type PublishReleaseParams,
} from '@/services/package-service';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { InstallationFilters } from '@/data/packages';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function usePackages() {
  return useQuery({ queryKey: queryKeys.packages.all, queryFn: () => packageService.list() });
}

export function usePackage(code: string) {
  return useQuery({
    queryKey: queryKeys.packages.detail(code),
    queryFn: () => packageService.getByCode(code),
    enabled: !!code,
  });
}

export function usePackageVersions(code: string) {
  return useQuery({
    queryKey: queryKeys.packages.versions(code),
    queryFn: () => packageService.listVersions(code),
    enabled: !!code,
  });
}

export function useCompanyAssignments(companyId: string) {
  return useQuery({
    queryKey: queryKeys.packageAssignments.company(companyId),
    queryFn: () => assignmentService.listForCompany(companyId),
    enabled: !!companyId,
  });
}

export function useInstallationsMonitor(filters: InstallationFilters) {
  return useQuery({
    queryKey: queryKeys.installations.monitor(filters as Record<string, unknown>),
    queryFn: () => installationService.list(filters),
  });
}

export function usePublishRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: PublishReleaseParams) => releaseService.publish(params),
    onSuccess: (result) => {
      notify.recordCreated(`Release (${result.packageCode} ${result.version} → ${result.targetCount})`);
      invalidate(qc, invalidationTargets.publishRelease());
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
