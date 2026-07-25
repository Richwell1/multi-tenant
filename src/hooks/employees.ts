import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { employeeService } from '@/services/employee-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { CreateEmployeeInput, TerminateEmployeeInput } from '@/data/employees';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useEmployees() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.employees.list(companyId ?? 'none'),
    queryFn: () => employeeService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useEmployee(employeeId: string) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.employees.detail(companyId ?? 'none', employeeId),
    queryFn: () => employeeService.getById(companyId!, employeeId),
    enabled: !!companyId && !!employeeId,
  });
}

export function useCreateEmployee() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeeService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Employee');
      invalidate(qc, invalidationTargets.createEmployee(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useTerminateEmployee(employeeId: string) {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TerminateEmployeeInput = {}) =>
      employeeService.terminate(companyId!, employeeId, input),
    onSuccess: () => {
      notify.recordUpdated('Employee');
      invalidate(qc, invalidationTargets.terminateEmployee(companyId!, employeeId));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
