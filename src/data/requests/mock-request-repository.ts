import { requestRecords } from '@/data/mock';
import type { RequestRepository } from './request-repository';
import type { CreateRequestInput, RequestRecord, RequestStatus } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);
const today = () => new Date().toISOString().slice(0, 10);

/** Mock adapter — reads the static seed; mutations are simulated (no persistence). */
export class MockRequestRepository implements RequestRepository {
  async list(): Promise<RequestRecord[]> {
    await delay();
    return clone(requestRecords);
  }

  async getById(id: string): Promise<RequestRecord | undefined> {
    await delay();
    return clone(requestRecords.find((r) => r.id === id));
  }

  async create(input: CreateRequestInput): Promise<RequestRecord> {
    await delay();
    return {
      id: `req-${Date.now()}`,
      companyId: input.companyId,
      sourceEmailReference: input.sourceEmailReference,
      title: input.title,
      requestType: input.requestType,
      description: input.description,
      priority: input.priority,
      status: 'received',
      internalNote: '',
      diagnosticId: null,
      linkedPackageKey: null,
      createdAt: today(),
      updatedAt: today(),
    };
  }

  async changeStatus(id: string, status: RequestStatus): Promise<RequestRecord> {
    await delay();
    const existing = requestRecords.find((r) => r.id === id);
    return { ...clone(existing ?? ({} as RequestRecord)), id, status, updatedAt: today() };
  }
}
