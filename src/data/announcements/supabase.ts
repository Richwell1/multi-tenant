import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { Announcement, AnnouncementsRepository, CreateAnnouncementInput } from './index';

const COLS = 'id,company_id,title,body,created_at';

interface Row {
  id: string;
  company_id: string;
  title: string;
  body: string;
  created_at: string;
}

const toDomain = (r: Row): Announcement => ({
  id: r.id,
  companyId: r.company_id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
});

export class SupabaseAnnouncementsRepository implements AnnouncementsRepository {
  async list(companyId: string): Promise<Announcement[]> {
    const { data, error } = await getSupabaseClient()
      .from('announcements')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'announcements.list');
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateAnnouncementInput): Promise<Announcement> {
    const { data, error } = await getSupabaseClient()
      .from('announcements')
      .insert({ company_id: companyId, title: input.title, body: input.body ?? '' })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error, 'announcements.create');
    return toDomain(data as unknown as Row);
  }
}
