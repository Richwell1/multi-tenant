import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingChecklistService, type ChecklistItemFormValues } from '@/services/onboarding-checklist-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function useChecklistItems() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.onboardingChecklist.list(companyId ?? 'none'),
    queryFn: () => onboardingChecklistService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateChecklistItem() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChecklistItemFormValues) => onboardingChecklistService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Checklist item');
      qc.invalidateQueries({ queryKey: queryKeys.onboardingChecklist.list(companyId!) });
    },
  });
}

export function useSetChecklistItemDone() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      onboardingChecklistService.setDone(companyId!, id, done),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.onboardingChecklist.list(companyId!) });
    },
  });
}
