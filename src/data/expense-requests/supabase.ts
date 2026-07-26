import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { CreateExpenseRequestInput, ExpenseRequest, ExpenseRequestsRepository } from './index';

const COLS = 'id,company_id,amount,description,status,created_at';

interface Row {
  id: string;
  company_id: string;
  amount: number | string;
  description: string;
  status: string;
  created_at: string;
}

const toDomain = (r: Row): ExpenseRequest => ({
  id: r.id,
  companyId: r.company_id,
  amount: Number(r.amount),
  description: r.description,
  status: r.status,
  createdAt: r.created_at,
});

export class SupabaseExpenseRequestsRepository implements ExpenseRequestsRepository {
  async list(companyId: string): Promise<ExpenseRequest[]> {
    const { data, error } = await getSupabaseClient()
      .from('expense_requests')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateExpenseRequestInput): Promise<ExpenseRequest> {
    const { data, error } = await getSupabaseClient()
      .from('expense_requests')
      .insert({ company_id: companyId, amount: input.amount, description: input.description ?? '' })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }
}
