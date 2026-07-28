import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { Asset, AssetsRepository, AssetStatus, CreateAssetInput } from './index';

const COLS = 'id,company_id,name,asset_tag,assigned_to,status,created_at';

interface Row {
  id: string;
  company_id: string;
  name: string;
  asset_tag: string;
  assigned_to: string;
  status: string;
  created_at: string;
}

const toDomain = (r: Row): Asset => ({
  id: r.id,
  companyId: r.company_id,
  name: r.name,
  assetTag: r.asset_tag,
  assignedTo: r.assigned_to,
  status: (r.status as AssetStatus) ?? 'available',
  createdAt: r.created_at,
});

export class SupabaseAssetsRepository implements AssetsRepository {
  async list(companyId: string): Promise<Asset[]> {
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select(COLS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'assets.list');
    return (data as unknown as Row[]).map(toDomain);
  }

  async create(companyId: string, input: CreateAssetInput): Promise<Asset> {
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .insert({
        company_id: companyId,
        name: input.name,
        asset_tag: input.assetTag ?? '',
        assigned_to: input.assignedTo ?? '',
        status: input.status ?? (input.assignedTo ? 'assigned' : 'available'),
      })
      .select(COLS)
      .single();
    if (error) throw mapSupabaseError(error, 'assets.create');
    return toDomain(data as unknown as Row);
  }
}
