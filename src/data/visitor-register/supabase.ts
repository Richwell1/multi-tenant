import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { CreateVisitorInput, VisitorEntry, VisitorRegisterRepository } from './index';

const COLS = 'id,company_id,visitor_name,visit_purpose,created_at';

interface Row {
  id: string;
  company_id: string;
  visitor_name: string;
  visit_purpose: string;
  created_at: string;
}

const toDomain = (r: Row): VisitorEntry => ({
  id: r.id,
  companyId: r.company_id,
  visitorName: r.visitor_name,
  visitPurpose: r.visit_purpose,
  createdAt: r.created_at,
});

export class SupabaseVisitorRegisterRepository implements VisitorRegisterRepository {
  async list(companyId: string): Promise<VisitorEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('visitor_register')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateVisitorInput): Promise<VisitorEntry> {
    const { data, error } = await getSupabaseClient()
      .from('visitor_register')
      .insert({ company_id: companyId, visitor_name: input.visitorName, visit_purpose: input.visitPurpose ?? '' })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
