import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { CreateDocumentNoteInput, DocumentNote, DocumentNotesRepository } from './index';

const COLS = 'id,company_id,title,description,category,created_at';

interface Row {
  id: string;
  company_id: string;
  title: string;
  description: string;
  category: string | null;
  created_at: string;
}

const toDomain = (r: Row): DocumentNote => ({
  id: r.id,
  companyId: r.company_id,
  title: r.title,
  description: r.description,
  category: r.category,
  createdAt: r.created_at,
});

export class SupabaseDocumentNotesRepository implements DocumentNotesRepository {
  async list(companyId: string): Promise<DocumentNote[]> {
    const { data, error } = await getSupabaseClient()
      .from('document_notes')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateDocumentNoteInput): Promise<DocumentNote> {
    const { data, error } = await getSupabaseClient()
      .from('document_notes')
      .insert({
        company_id: companyId,
        title: input.title,
        description: input.description ?? '',
        category: input.category || null,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
