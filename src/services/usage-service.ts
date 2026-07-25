// ---------------------------------------------------------------------------
// Usage analytics service. Aggregation happens server-side (audit-derived); the
// service just resolves a company-target selection into the repository filter.
// ---------------------------------------------------------------------------

import { usageRepository, type UsageFilters } from '@/data/usage';

export const usageService = {
  list: (filters?: UsageFilters) => usageRepository.list(filters),
};
