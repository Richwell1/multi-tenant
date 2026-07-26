import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { DepartmentRepository } from './department-repository';
import type { CreateDepartmentInput, Department, UpdateDepartmentInput } from './types';

const COLS = 'id,company_id,name,code,head,status';

interface Row {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  head: string | null;
  status: 'active' | 'disabled';
}

const toDomain = (r: Row): Department => ({
  id: r.id,
  tenantId: r.company_id,
  name: r.name,
  code: r.code ?? '',
  head: r.head ?? '',
  status: r.status,
});

/** company_id filters are defense-in-depth; RLS is the authoritative boundary. */
export class SupabaseDepartmentRepository implements DepartmentRepository {
  async list(companyId: string): Promise<Department[]> {
    const { data, error } = await getSupabaseClient()
      .from('departments')
      .select(COLS)
      .eq('company_id', companyId)
      .order('name');
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async getById(companyId: string, id: string): Promise<Department | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('departments')
      .select(COLS)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? toDomain(data as unknown as Row) : undefined;
  }

  async create(companyId: string, input: CreateDepartmentInput): Promise<Department> {
    const { data, error } = await getSupabaseClient()
      .from('departments')
      .insert({ company_id: companyId, name: input.name, code: input.code || null, head: input.head ?? null })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error);
    return toDomain(data as unknown as Row);
  }

  async update(companyId: string, id: string, input: UpdateDepartmentInput): Promise<Department> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.code !== undefined) patch.code = input.code;
    if (input.head !== undefined) patch.head = input.head;
    if (input.status !== undefined) patch.status = input.status;
    const { data, error } = await getSupabaseClient()
      .from('departments')
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
      .from('departments')
      .update({ status: 'disabled' })
      .eq('company_id', companyId)
      .eq('id', id);
    if (error) throw mapSupabaseError(error);
  }
}
