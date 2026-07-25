import { usageMetrics } from '@/data/mock';
import type { UsageRepository } from './usage-repository';
import type { UsageFilters, UsageMetric } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

/** Mock adapter — returns the static seed (the company filter is a Supabase concern). */
export class MockUsageRepository implements UsageRepository {
  async list(_filters: UsageFilters = {}): Promise<UsageMetric[]> {
    void _filters;
    await delay();
    return clone(usageMetrics);
  }
}
