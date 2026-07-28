import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pulseSurveysService, type PulseSurveyFormValues } from '@/services/pulse-surveys-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function usePulseSurveys() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.pulseSurveys.list(companyId ?? 'none'),
    queryFn: () => pulseSurveysService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreatePulseSurvey() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PulseSurveyFormValues) => pulseSurveysService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Survey');
      qc.invalidateQueries({ queryKey: queryKeys.pulseSurveys.list(companyId!) });
    },
  });
}
