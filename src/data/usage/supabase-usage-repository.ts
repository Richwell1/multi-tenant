import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { UsageRepository } from './usage-repository';
import type { UsageFilters, UsageMetric } from './types';

interface Row {
  module: string;
  action_count: number;
  companies_using: number;
}

export class SupabaseUsageRepository implements UsageRepository {
  async list(filters: UsageFilters = {}): Promise<UsageMetric[]> {
    const { data, error } = await getSupabaseClient().rpc('usage_metrics', {
      p_company_ids: filters.companyIds ?? undefined,
    });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map((r) => ({
      module: r.module,
      actionCount: Number(r.action_count),
      companiesUsing: Number(r.companies_using),
    }));
  }
}
