import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { visitorRegisterService, type VisitorFormValues } from '@/services/visitor-register-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function useVisitorEntries() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.visitorRegister.list(companyId ?? 'none'),
    queryFn: () => visitorRegisterService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateVisitor() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VisitorFormValues) => visitorRegisterService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Visitor');
      qc.invalidateQueries({ queryKey: queryKeys.visitorRegister.list(companyId!) });
    },
    // Errors are shown inline beside the form; no duplicate toast here.
  });
}
