import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit-service';
import { queryKeys } from '@/lib/query-keys';
import { companyTargetKeyPart, type CompanyTargetValue } from '@/lib/company-target';

/** Platform audit log scoped to a company-target selection (the key embeds it). */
export function useAudit(target: CompanyTargetValue) {
  const companyIds = target.mode === 'all_companies' ? undefined : target.companyIds;
  return useQuery({
    queryKey: queryKeys.audit.list(companyTargetKeyPart(target)),
    queryFn: () => auditService.list({ companyIds }),
  });
}
