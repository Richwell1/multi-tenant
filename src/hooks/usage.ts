import { useQuery } from '@tanstack/react-query';
import { usageService } from '@/services/usage-service';
import { queryKeys } from '@/lib/query-keys';
import { companyTargetKeyPart, type CompanyTargetValue } from '@/lib/company-target';

/** Usage analytics scoped to a company-target selection (the key embeds it). */
export function useUsage(target: CompanyTargetValue) {
  // all_companies → no filter; RLS/self-gate keeps this platform-plane.
  const companyIds = target.mode === 'all_companies' ? undefined : target.companyIds;
  return useQuery({
    queryKey: queryKeys.usage.summary(companyTargetKeyPart(target)),
    queryFn: () => usageService.list({ companyIds }),
  });
}
