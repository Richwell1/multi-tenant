import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { leaveService, type LeaveRequestFormValues } from '@/services/leave-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { LeaveDecision, LeaveStatus } from '@/data/leave';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useLeaveRequests() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.leave.list(companyId ?? 'none'),
    queryFn: () => leaveService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateLeaveRequest() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaveRequestFormValues) => leaveService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Leave request');
      invalidate(qc, invalidationTargets.createLeaveRequest(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useDecideLeaveRequest() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, current, status }: { id: string; current: LeaveStatus; status: LeaveDecision }) =>
      leaveService.decide(companyId!, id, current, { status }),
    onSuccess: (res) => {
      notify.requestStatusChanged(res.status);
      invalidate(qc, invalidationTargets.decideLeaveRequest(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
