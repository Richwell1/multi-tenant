import type { RequestRecord, RequestStatus } from '@/data/types';

export type { RequestRecord, RequestStatus };

export type RequestPriority = RequestRecord['priority'];

export interface CreateRequestInput {
  companyId: string;
  title: string;
  requestType: string;
  sourceEmailReference: string;
  description: string;
  priority: RequestPriority;
}
