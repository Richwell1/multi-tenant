// Custom Visitor Register — a minimal private standalone feature (list + create).
import { resolveDataSource } from '@/data/repository';

export interface VisitorEntry {
  id: string;
  companyId: string;
  visitorName: string;
  visitPurpose: string;
  createdAt: string;
}

export interface CreateVisitorInput {
  visitorName: string;
  visitPurpose?: string;
}

export interface VisitorRegisterRepository {
  list(companyId: string): Promise<VisitorEntry[]>;
  create(companyId: string, input: CreateVisitorInput): Promise<VisitorEntry>;
}

class MockVisitorRegisterRepository implements VisitorRegisterRepository {
  private rows = new Map<string, VisitorEntry[]>();
  async list(companyId: string): Promise<VisitorEntry[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.rows.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateVisitorInput): Promise<VisitorEntry> {
    await new Promise((r) => setTimeout(r, 200));
    const row: VisitorEntry = {
      id: `vr-${Date.now()}`,
      companyId,
      visitorName: input.visitorName,
      visitPurpose: input.visitPurpose ?? '',
      createdAt: new Date().toISOString(),
    };
    this.rows.set(companyId, [row, ...(this.rows.get(companyId) ?? [])]);
    return row;
  }
}

class LazySupabaseVisitorRegisterRepository implements VisitorRegisterRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseVisitorRegisterRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateVisitorInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createVisitorRegisterRepository(source = resolveDataSource()): VisitorRegisterRepository {
  return source === 'supabase' ? new LazySupabaseVisitorRegisterRepository() : new MockVisitorRegisterRepository();
}

export const visitorRegisterRepository: VisitorRegisterRepository = createVisitorRegisterRepository();
