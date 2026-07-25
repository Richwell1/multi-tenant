import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { PositionRepository } from './position-repository';
import type { CreatePositionInput, Position, UpdatePositionInput } from './types';

const COLS = 'id,company_id,title,code,reports_to,status,departments(name)';

interface Row {
  id: string;
  company_id: string;
  title: string;
  code: string;
  reports_to: string | null;
  status: 'active' | 'disabled';
  departments: { name: string } | null;
}

const toDomain = (r: Row): Position => ({
  id: r.id,
  tenantId: r.company_id,
  title: r.title,
  code: r.code,
  department: r.departments?.name ?? '',
  reportsTo: r.reports_to ?? '',
  status: r.status,
});

export class SupabasePositionRepository implements PositionRepository {
  async list(companyId: string): Promise<Position[]> {
    const { data, error } = await getSupabaseClient()
      .from('positions')
      .select(COLS)
      .eq('company_id', companyId)
      .order('title');
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async getById(companyId: string, id: string): Promise<Position | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('positions')
      .select(COLS)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? toDomain(data as unknown as Row) : undefined;
  }

  async create(companyId: string, input: CreatePositionInput): Promise<Position> {
    const { data, error } = await getSupabaseClient()
      .from('positions')
      .insert({
        company_id: companyId,
        department_id: input.departmentId ?? null,
        title: input.title,
        code: input.code,
        reports_to: input.reportsTo ?? null,
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async update(companyId: string, id: string, input: UpdatePositionInput): Promise<Position> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.code !== undefined) patch.code = input.code;
    if (input.departmentId !== undefined) patch.department_id = input.departmentId || null;
    if (input.reportsTo !== undefined) patch.reports_to = input.reportsTo;
    if (input.status !== undefined) patch.status = input.status;
    const { data, error } = await getSupabaseClient()
      .from('positions')
      .update(patch)
      .eq('company_id', companyId)
      .eq('id', id)
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async disable(companyId: string, id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('positions')
      .update({ status: 'disabled' })
      .eq('company_id', companyId)
      .eq('id', id);
    if (error) throw mapSupabaseError(error);
  }
}
