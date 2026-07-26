import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyUpdatesService } from '@/services/company-updates-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';

/** Company-scoped pending updates (single source of truth for page + badge). */
export function useAvailableUpdates() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.updates.list(companyId ?? 'none'),
    queryFn: () => companyUpdatesService.list(companyId!),
    enabled: !!companyId,
  });
}

/** The pending-update count — reads the SAME query/cache as the page. */
export function useAvailableUpdateCount(): number {
  return useAvailableUpdates().data?.length ?? 0;
}

/** Install one assigned update. Pending state is scoped per install via `variables`. */
export function useInstallCompanyUpdate() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installationId: string) => companyUpdatesService.install(installationId),
    onSuccess: (res) => {
      notify.updateInstalled(res.packageKey);
      // Refresh the updates list (decrements the badge) + entitlement context
      // (installed version / nav) + the installed-packages catalog.
      qc.invalidateQueries({ queryKey: queryKeys.updates.list(companyId!) });
      qc.invalidateQueries({ queryKey: ['context'] });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
