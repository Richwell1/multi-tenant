import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { ChecklistItem, CreateChecklistItemInput, OnboardingChecklistRepository } from './index';

const COLS = 'id,company_id,label,done,created_at';

interface Row {
  id: string;
  company_id: string;
  label: string;
  done: boolean;
  created_at: string;
}

const toDomain = (r: Row): ChecklistItem => ({
  id: r.id,
  companyId: r.company_id,
  label: r.label,
  done: r.done,
  createdAt: r.created_at,
});

export class SupabaseOnboardingChecklistRepository implements OnboardingChecklistRepository {
  async list(companyId: string): Promise<ChecklistItem[]> {
    const { data, error } = await getSupabaseClient()
      .from('onboarding_checklist_items')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (error) throw mapSupabaseError(error, 'onboarding-checklist.list');
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateChecklistItemInput): Promise<ChecklistItem> {
    const { data, error } = await getSupabaseClient()
      .from('onboarding_checklist_items')
      .insert({ company_id: companyId, label: input.label })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error, 'onboarding-checklist.create');
    return toDomain(data as unknown as Row);
  }

  async setDone(companyId: string, id: string, done: boolean): Promise<ChecklistItem> {
    const { data, error } = await getSupabaseClient()
      .from('onboarding_checklist_items')
      .update({ done })
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error, 'onboarding-checklist.setDone');
    return toDomain(data as unknown as Row);
  }
}
