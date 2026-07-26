// Expense Requests — a minimal marketplace feature (list + create).
import { resolveDataSource } from '@/data/repository';

export interface ExpenseRequest {
  id: string;
  companyId: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

export interface CreateExpenseRequestInput {
  amount: number;
  description?: string;
}

export interface ExpenseRequestsRepository {
  list(companyId: string): Promise<ExpenseRequest[]>;
  create(companyId: string, input: CreateExpenseRequestInput): Promise<ExpenseRequest>;
}

class MockExpenseRequestsRepository implements ExpenseRequestsRepository {
  private rows = new Map<string, ExpenseRequest[]>();
  async list(companyId: string): Promise<ExpenseRequest[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.rows.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateExpenseRequestInput): Promise<ExpenseRequest> {
    await new Promise((r) => setTimeout(r, 200));
    const row: ExpenseRequest = {
      id: `ex-${Date.now()}`,
      companyId,
      amount: input.amount,
      description: input.description ?? '',
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
    this.rows.set(companyId, [row, ...(this.rows.get(companyId) ?? [])]);
    return row;
  }
}

class LazySupabaseExpenseRequestsRepository implements ExpenseRequestsRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseExpenseRequestsRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateExpenseRequestInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createExpenseRequestsRepository(source = resolveDataSource()): ExpenseRequestsRepository {
  return source === 'supabase' ? new LazySupabaseExpenseRequestsRepository() : new MockExpenseRequestsRepository();
}

export const expenseRequestsRepository: ExpenseRequestsRepository = createExpenseRequestsRepository();
