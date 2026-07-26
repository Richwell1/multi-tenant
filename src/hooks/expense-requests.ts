import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseRequestsService, type ExpenseRequestFormValues } from '@/services/expense-requests-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function useExpenseRequests() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.expenseRequests.list(companyId ?? 'none'),
    queryFn: () => expenseRequestsService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateExpenseRequest() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseRequestFormValues) => expenseRequestsService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Expense request');
      qc.invalidateQueries({ queryKey: queryKeys.expenseRequests.list(companyId!) });
    },
    // Errors are shown inline beside the form; no duplicate toast here.
  });
}
