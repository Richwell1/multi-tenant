import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceService } from '@/services/marketplace-service';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';

export function useMarketplacePackages() {
  return useQuery({ queryKey: queryKeys.marketplace.all, queryFn: () => marketplaceService.list() });
}

export function useMarketplaceAdoption() {
  return useQuery({ queryKey: queryKeys.marketplace.adoption, queryFn: () => marketplaceService.adoption() });
}

/**
 * Company self-install. On success invalidate ONLY the current company's
 * entitlement/context and package queries so the new feature appears.
 */
export function useInstallMarketplaceExtension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageKey: string) => marketplaceService.install(packageKey),
    onSuccess: (result) => {
      notify.recordCreated(`Extension ${result.packageKey}`);
      qc.invalidateQueries({ queryKey: ['context'] });
      qc.invalidateQueries({ queryKey: queryKeys.marketplace.all });
      qc.invalidateQueries({ queryKey: queryKeys.packages.all });
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
