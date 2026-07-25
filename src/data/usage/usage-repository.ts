import type { UsageFilters, UsageMetric } from './types';

/** Platform-plane usage analytics (aggregated from the audit trail server-side). */
export interface UsageRepository {
  list(filters?: UsageFilters): Promise<UsageMetric[]>;
}
