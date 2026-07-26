import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { HealthRepository } from './index';
import type { HealthSignal } from '@/data/types';

interface Row {
  label: string;
  value: string;
  status: HealthSignal['status'];
}

export class SupabaseHealthRepository implements HealthRepository {
  async list(): Promise<HealthSignal[]> {
    const { data, error } = await getSupabaseClient().rpc('system_health');
    if (error) throw mapSupabaseError(error, 'admin.health.list');
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      label: r.label,
      value: r.value,
      status: r.status,
    }));
  }
}
