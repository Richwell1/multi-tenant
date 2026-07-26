import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { AuditFilters, AuditRepository } from './index';
import type { AuditLogEntry } from '@/data/types';

interface Row {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  entity_type: string;
  target: string;
}

export class SupabaseAuditRepository implements AuditRepository {
  async list(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
    const { data, error } = await getSupabaseClient().rpc('platform_audit_log', {
      p_company_ids: filters.companyIds ?? undefined,
      p_limit: filters.limit ?? 200,
    });
    if (error) throw mapSupabaseError(error, 'admin.audit.list');
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      actor: r.actor,
      action: r.action,
      target: r.target,
    }));
  }
}
