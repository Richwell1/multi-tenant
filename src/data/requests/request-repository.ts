import type { CreateRequestInput, RequestRecord, RequestStatus } from './types';

/** Platform-plane request access. RLS restricts every operation to Platform Admins. */
export interface RequestRepository {
  list(): Promise<RequestRecord[]>;
  getById(id: string): Promise<RequestRecord | undefined>;
  create(input: CreateRequestInput): Promise<RequestRecord>;
  changeStatus(id: string, status: RequestStatus): Promise<RequestRecord>;
}
