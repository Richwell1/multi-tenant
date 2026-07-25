import type { UsageMetric } from '@/data/types';

export type { UsageMetric };

export interface UsageFilters {
  /** Undefined → all companies; otherwise scope the aggregate to these companies. */
  companyIds?: string[];
}
