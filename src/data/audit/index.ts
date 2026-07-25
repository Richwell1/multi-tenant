import { resolveDataSource } from '@/data/repository';
import { auditLog } from '@/data/mock';
import type { AuditLogEntry } from '@/data/types';

export type { AuditLogEntry };

export interface AuditFilters {
  companyIds?: string[];
  limit?: number;
}

/** Platform-plane audit log (enriched + gated server-side). */
export interface AuditRepository {
  list(filters?: AuditFilters): Promise<AuditLogEntry[]>;
}

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

class MockAuditRepository implements AuditRepository {
  async list(): Promise<AuditLogEntry[]> {
    await delay();
    return clone(auditLog);
  }
}

class LazySupabaseAuditRepository implements AuditRepository {
  list(filters?: AuditFilters) {
    return import('./supabase-audit-repository').then((m) =>
      new m.SupabaseAuditRepository().list(filters),
    );
  }
}

export function createAuditRepository(source = resolveDataSource()): AuditRepository {
  return source === 'supabase' ? new LazySupabaseAuditRepository() : new MockAuditRepository();
}

export const auditRepository: AuditRepository = createAuditRepository();
