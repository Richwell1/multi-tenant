import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { requestService, type RequestFormValues } from '@/services/request-service';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { RequestRecord, RequestStatus } from '@/data/requests';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useRequests() {
  return useQuery({ queryKey: queryKeys.requests.all, queryFn: () => requestService.list() });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: () => requestService.getById(id),
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestFormValues) => requestService.create(input),
    onSuccess: () => {
      notify.recordCreated('Request record');
      invalidate(qc, invalidationTargets.createRequest());
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

/** Optimistic: the pipeline status flips immediately, rolls back on failure. */
export function useChangeRequestStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: RequestStatus; next: RequestStatus }) =>
      requestService.changeStatus(id, current, next),
    onMutate: async ({ next }) => {
      await qc.cancelQueries({ queryKey: queryKeys.requests.detail(id) });
      const previous = qc.getQueryData<RequestRecord>(queryKeys.requests.detail(id));
      if (previous) qc.setQueryData(queryKeys.requests.detail(id), { ...previous, status: next });
      return { previous };
    },
    onError: (e: NetworkError, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.requests.detail(id), ctx.previous);
      notify.networkFailure(e.message);
    },
    onSuccess: (res) => notify.requestStatusChanged(res.status.replace(/_/g, ' ')),
    onSettled: () => invalidate(qc, invalidationTargets.changeRequestStatus(id)),
  });
}
