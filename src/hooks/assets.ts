import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assetsService, type AssetFormValues } from '@/services/assets-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function useAssets() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.assets.list(companyId ?? 'none'),
    queryFn: () => assetsService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateAsset() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssetFormValues) => assetsService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Asset');
      qc.invalidateQueries({ queryKey: queryKeys.assets.list(companyId!) });
    },
  });
}
