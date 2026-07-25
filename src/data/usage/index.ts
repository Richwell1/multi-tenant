import { resolveDataSource } from '@/data/repository';
import { MockUsageRepository } from './mock-usage-repository';
import type { UsageRepository } from './usage-repository';
import type { UsageFilters } from './types';

class LazySupabaseUsageRepository implements UsageRepository {
  list(filters?: UsageFilters) {
    return import('./supabase-usage-repository').then((m) =>
      new m.SupabaseUsageRepository().list(filters),
    );
  }
}

export function createUsageRepository(source = resolveDataSource()): UsageRepository {
  return source === 'supabase' ? new LazySupabaseUsageRepository() : new MockUsageRepository();
}

export const usageRepository: UsageRepository = createUsageRepository();

export type { UsageRepository } from './usage-repository';
export type { UsageMetric, UsageFilters } from './types';
