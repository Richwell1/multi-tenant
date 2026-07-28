import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { CreatePulseSurveyInput, PulseSurvey, PulseSurveyStatus, PulseSurveysRepository } from './index';

const COLS = 'id,company_id,question,description,status,created_at';

interface Row {
  id: string;
  company_id: string;
  question: string;
  description: string;
  status: string;
  created_at: string;
}

const toDomain = (r: Row): PulseSurvey => ({
  id: r.id,
  companyId: r.company_id,
  question: r.question,
  description: r.description,
  status: (r.status as PulseSurveyStatus) ?? 'active',
  createdAt: r.created_at,
});

export class SupabasePulseSurveysRepository implements PulseSurveysRepository {
  async list(companyId: string): Promise<PulseSurvey[]> {
    const { data, error } = await getSupabaseClient()
      .from('pulse_surveys')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'pulse-surveys.list');
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreatePulseSurveyInput): Promise<PulseSurvey> {
    const { data, error } = await getSupabaseClient()
      .from('pulse_surveys')
      .insert({
        company_id: companyId,
        question: input.question,
        description: input.description ?? '',
        status: input.status ?? 'active',
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error, 'pulse-surveys.create');
    return toDomain(data as unknown as Row);
  }
}
