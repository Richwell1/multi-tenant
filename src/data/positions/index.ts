import { resolveDataSource } from '@/data/repository';
import { MockPositionRepository } from './mock-position-repository';
import type { PositionRepository } from './position-repository';
import type { CreatePositionInput, UpdatePositionInput } from './types';

class LazySupabasePositionRepository implements PositionRepository {
  private impl = () => {
    return import('./supabase-position-repository').then((m) => new m.SupabasePositionRepository());
  };
  list = (companyId: string) => {
    return this.impl().then((r) => r.list(companyId));
  };
  getById = (companyId: string, id: string) => {
    return this.impl().then((r) => r.getById(companyId, id));
  };
  create = (companyId: string, input: CreatePositionInput) => {
    return this.impl().then((r) => r.create(companyId, input));
  };
  update = (companyId: string, id: string, input: UpdatePositionInput) => {
    return this.impl().then((r) => r.update(companyId, id, input));
  };
  disable = (companyId: string, id: string) => {
    return this.impl().then((r) => r.disable(companyId, id));
  };
}

export function createPositionRepository(source = resolveDataSource()): PositionRepository {
  return source === 'supabase' ? new LazySupabasePositionRepository() : new MockPositionRepository();
}

export const positionRepository: PositionRepository = createPositionRepository();

export type { PositionRepository } from './position-repository';
export type { Position, CreatePositionInput, UpdatePositionInput, PositionStatus } from './types';
