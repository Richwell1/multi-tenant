import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { diagnosticService } from '@/services/diagnostic-service';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { RunDiagnosticInput } from '@/data/diagnostics';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useDiagnostics() {
  return useQuery({ queryKey: queryKeys.diagnostics.all, queryFn: diagnosticService.list });
}

export function useDiagnostic(id: string) {
  return useQuery({
    queryKey: queryKeys.diagnostics.detail(id),
    queryFn: () => diagnosticService.getById(id),
    enabled: !!id,
  });
}

export function useRunDiagnostic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RunDiagnosticInput) => diagnosticService.run(input),
    onSuccess: () => {
      notify.recordCreated('Diagnostic report');
      invalidate(qc, invalidationTargets.runDiagnostic());
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
