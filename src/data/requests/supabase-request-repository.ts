import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { PackageKey } from '@/data/types';
import type { RequestRepository } from './request-repository';
import type { CreateRequestInput, RequestRecord, RequestStatus } from './types';

const COLS =
  'id,company_id,source_email_reference,title,request_type,description,priority,status,' +
  'internal_note,linked_package_key,linked_package_version,diagnostic_id,created_at,updated_at';

interface Row {
  id: string;
  company_id: string;
  source_email_reference: string;
  title: string;
  request_type: string;
  description: string;
  priority: RequestRecord['priority'];
  status: RequestStatus;
  internal_note: string;
  linked_package_key: string | null;
  linked_package_version: string | null;
  diagnostic_id: string | null;
  created_at: string;
  updated_at: string;
}

const toDomain = (r: Row): RequestRecord => ({
  id: r.id,
  companyId: r.company_id,
  sourceEmailReference: r.source_email_reference,
  title: r.title,
  requestType: r.request_type,
  description: r.description,
  priority: r.priority,
  status: r.status,
  internalNote: r.internal_note,
  diagnosticId: r.diagnostic_id,
  linkedPackageKey: (r.linked_package_key as PackageKey | null) ?? null,
  createdAt: r.created_at.slice(0, 10),
  updatedAt: r.updated_at.slice(0, 10),
});

export class SupabaseRequestRepository implements RequestRepository {
  async list(): Promise<RequestRecord[]> {
    const { data, error } = await getSupabaseClient()
      .from('request_records')
      .select(COLS)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async getById(id: string): Promise<RequestRecord | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('request_records')
      .select(COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? toDomain(data as unknown as Row) : undefined;
  }

  async create(input: CreateRequestInput): Promise<RequestRecord> {
    const { data, error } = await getSupabaseClient()
      .from('request_records')
      .insert({
        company_id: input.companyId,
        source_email_reference: input.sourceEmailReference,
        title: input.title,
        request_type: input.requestType,
        description: input.description,
        priority: input.priority,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async changeStatus(id: string, status: RequestStatus): Promise<RequestRecord> {
    const { data, error } = await getSupabaseClient()
      .from('request_records')
      .update({ status })
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
