import { resolveDataSource } from '@/data/repository';
import { healthSignals } from '@/data/mock';
import type { HealthSignal } from '@/data/types';

export type { HealthSignal };

/** Platform-plane system health signals (derived + gated server-side). */
export interface HealthRepository {
  list(): Promise<HealthSignal[]>;
}

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

class MockHealthRepository implements HealthRepository {
  async list(): Promise<HealthSignal[]> {
    await delay();
    return clone(healthSignals);
  }
}

class LazySupabaseHealthRepository implements HealthRepository {
  list() {
    return import('./supabase-health-repository').then((m) => new m.SupabaseHealthRepository().list());
  }
}

export function createHealthRepository(source = resolveDataSource()): HealthRepository {
  return source === 'supabase' ? new LazySupabaseHealthRepository() : new MockHealthRepository();
}

export const healthRepository: HealthRepository = createHealthRepository();
