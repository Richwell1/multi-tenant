import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { positionService } from '@/services/position-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { CreatePositionInput } from '@/data/positions';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function usePositions() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.positions.all(companyId ?? 'none'),
    queryFn: () => positionService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreatePosition() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePositionInput) => positionService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Position');
      invalidate(qc, invalidationTargets.createPosition(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useDisablePosition() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => positionService.disable(companyId!, id),
    onSuccess: () => {
      notify.recordDisabled('Position');
      invalidate(qc, invalidationTargets.disablePosition(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
