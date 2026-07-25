import { resolveDataSource } from '@/data/repository';
import { MockRequestRepository } from './mock-request-repository';
import type { RequestRepository } from './request-repository';
import type { CreateRequestInput, RequestStatus } from './types';

class LazySupabaseRequestRepository implements RequestRepository {
  private impl() {
    return import('./supabase-request-repository').then((m) => new m.SupabaseRequestRepository());
  }
  list() {
    return this.impl().then((r) => r.list());
  }
  getById(id: string) {
    return this.impl().then((r) => r.getById(id));
  }
  create(input: CreateRequestInput) {
    return this.impl().then((r) => r.create(input));
  }
  changeStatus(id: string, status: RequestStatus) {
    return this.impl().then((r) => r.changeStatus(id, status));
  }
}

export function createRequestRepository(source = resolveDataSource()): RequestRepository {
  return source === 'supabase' ? new LazySupabaseRequestRepository() : new MockRequestRepository();
}

export const requestRepository: RequestRepository = createRequestRepository();

export type { RequestRepository } from './request-repository';
export type { RequestRecord, RequestStatus, RequestPriority, CreateRequestInput } from './types';
export { REQUEST_TRANSITIONS, canTransition, allowedNextStatuses } from './transitions';
