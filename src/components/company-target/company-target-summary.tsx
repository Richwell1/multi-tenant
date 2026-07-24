import { Badge } from '@/components/ui/badge';
import { TARGET_MODE_LABEL, type CompanyTargetValue } from '@/lib/company-target';
import type { CompanyOption } from './selected-company-chips';

interface CompanyTargetSummaryProps {
  value: CompanyTargetValue;
  companies: CompanyOption[];
}

/** Read-only, human-readable summary of a target selection. */
export function CompanyTargetSummary({ value, companies }: CompanyTargetSummaryProps) {
  const byId = new Map(companies.map((c) => [c.id, c.name]));
  const names = value.companyIds.map((id) => byId.get(id) ?? id);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone="platform">{TARGET_MODE_LABEL[value.mode]}</Badge>
      {value.mode === 'all_companies' ? (
        <span className="text-content-variant">Applies to every active company</span>
      ) : (
        <span className="text-content">{names.join(', ') || 'No companies selected'}</span>
      )}
    </div>
  );
}
