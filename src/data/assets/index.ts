// Asset Register — a marketplace feature (list + create). Entitlement + RLS are
// the real boundary; the mock adapter simulates writes for the demo.
import { resolveDataSource } from '@/data/repository';

export type AssetStatus = 'available' | 'assigned' | 'retired';

export interface Asset {
  id: string;
  companyId: string;
  name: string;
  assetTag: string;
  assignedTo: string;
  status: AssetStatus;
  createdAt: string;
}

export interface CreateAssetInput {
  name: string;
  assetTag?: string;
  assignedTo?: string;
  status?: AssetStatus;
}

export interface AssetsRepository {
  list(companyId: string): Promise<Asset[]>;
  create(companyId: string, input: CreateAssetInput): Promise<Asset>;
}

class MockAssetsRepository implements AssetsRepository {
  private items = new Map<string, Asset[]>();
  async list(companyId: string): Promise<Asset[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.items.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateAssetInput): Promise<Asset> {
    await new Promise((r) => setTimeout(r, 200));
    const item: Asset = {
      id: `as-${Date.now()}`,
      companyId,
      name: input.name,
      assetTag: input.assetTag ?? '',
      assignedTo: input.assignedTo ?? '',
      status: input.status ?? (input.assignedTo ? 'assigned' : 'available'),
      createdAt: new Date().toISOString(),
    };
    this.items.set(companyId, [item, ...(this.items.get(companyId) ?? [])]);
    return item;
  }
}

class LazySupabaseAssetsRepository implements AssetsRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseAssetsRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateAssetInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createAssetsRepository(source = resolveDataSource()): AssetsRepository {
  return source === 'supabase' ? new LazySupabaseAssetsRepository() : new MockAssetsRepository();
}

export const assetsRepository: AssetsRepository = createAssetsRepository();
