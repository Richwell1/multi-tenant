import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packageLifecycleRepository } from '@/data/package-lifecycle';
import { useCompanyId } from '@/hooks/use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';
import { RepositoryError } from '@/data/errors';

/** The caller's company packages with lifecycle/retention state. */
export function useCompanyPackages() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.packages.lifecycle(companyId ?? 'anon'),
    queryFn: () => packageLifecycleRepository.listCompanyPackages(companyId!),
    enabled: !!companyId,
  });
}

type LifecycleFn = (companyId: string, packageKey: string, reason?: string) => Promise<{ status: string }>;

/**
 * Shared lifecycle mutation. On success it invalidates ONLY the current company's
 * lifecycle list plus the entitlement/context so nav and gating refresh — never
 * a global blow-away. Errors surface the safe RepositoryError message.
 */
function useLifecycleMutation(fn: LifecycleFn, successToast: (status: string) => void) {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (vars: { packageKey: string; reason?: string }) => fn(companyId!, vars.packageKey, vars.reason),
    onSuccess: (result) => {
      successToast(result.status);
      qc.invalidateQueries({ queryKey: queryKeys.packages.lifecycle(companyId ?? 'anon') });
      qc.invalidateQueries({ queryKey: ['context'] });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
    onError: (e: unknown) => {
      notify.permissionDenied(e instanceof RepositoryError ? e.message : 'That action could not be completed.');
    },
  });
}

export function useDisablePackage() {
  return useLifecycleMutation((c, k) => packageLifecycleRepository.disable(c, k), () => notify.recordDisabled('Package'));
}
export function useEnablePackage() {
  return useLifecycleMutation((c, k) => packageLifecycleRepository.enable(c, k), () => notify.recordUpdated('Package'));
}
export function useUninstallPackage() {
  return useLifecycleMutation(
    (c, k, reason) => packageLifecycleRepository.uninstall(c, k, reason),
    () => notify.recordDisabled('Package'),
  );
}
export function useRestorePackage() {
  return useLifecycleMutation((c, k) => packageLifecycleRepository.restore(c, k), () => notify.recordUpdated('Package'));
}
export function usePermanentlyRemovePackage() {
  return useLifecycleMutation(
    (c, k) => packageLifecycleRepository.permanentlyRemove(c, k),
    () => notify.recordDeleted('Package data'),
  );
}
