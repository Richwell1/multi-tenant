import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { departmentService } from '@/services/department-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { CreateDepartmentInput } from '@/data/departments';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useDepartments() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.departments.all(companyId ?? 'none'),
    queryFn: () => departmentService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateDepartment() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => departmentService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Department');
      invalidate(qc, invalidationTargets.createDepartment(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useDisableDepartment() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentService.disable(companyId!, id),
    onSuccess: () => {
      notify.recordDisabled('Department');
      invalidate(qc, invalidationTargets.disableDepartment(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
