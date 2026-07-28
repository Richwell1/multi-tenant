// Custom Onboarding Checklist — a private HR Core extension (list + create +
// toggle done). Entitlement + RLS are the real boundary; the mock adapter
// simulates writes for the demo.
import { resolveDataSource } from '@/data/repository';

export interface ChecklistItem {
  id: string;
  companyId: string;
  label: string;
  done: boolean;
  createdAt: string;
}

export interface CreateChecklistItemInput {
  label: string;
}

export interface OnboardingChecklistRepository {
  list(companyId: string): Promise<ChecklistItem[]>;
  create(companyId: string, input: CreateChecklistItemInput): Promise<ChecklistItem>;
  setDone(companyId: string, id: string, done: boolean): Promise<ChecklistItem>;
}

class MockOnboardingChecklistRepository implements OnboardingChecklistRepository {
  private items = new Map<string, ChecklistItem[]>();
  async list(companyId: string): Promise<ChecklistItem[]> {
    await new Promise((r) => setTimeout(r, 150));
    return [...(this.items.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateChecklistItemInput): Promise<ChecklistItem> {
    await new Promise((r) => setTimeout(r, 150));
    const item: ChecklistItem = {
      id: `oc-${Date.now()}`,
      companyId,
      label: input.label,
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.items.set(companyId, [...(this.items.get(companyId) ?? []), item]);
    return item;
  }
  async setDone(companyId: string, id: string, done: boolean): Promise<ChecklistItem> {
    await new Promise((r) => setTimeout(r, 100));
    const list = this.items.get(companyId) ?? [];
    const item = list.find((i) => i.id === id);
    if (!item) throw new Error('not found');
    item.done = done;
    return { ...item };
  }
}

class LazySupabaseOnboardingChecklistRepository implements OnboardingChecklistRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseOnboardingChecklistRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateChecklistItemInput) => this.impl().then((r) => r.create(companyId, input));
  setDone = (companyId: string, id: string, done: boolean) => this.impl().then((r) => r.setDone(companyId, id, done));
}

export function createOnboardingChecklistRepository(source = resolveDataSource()): OnboardingChecklistRepository {
  return source === 'supabase'
    ? new LazySupabaseOnboardingChecklistRepository()
    : new MockOnboardingChecklistRepository();
}

export const onboardingChecklistRepository: OnboardingChecklistRepository = createOnboardingChecklistRepository();
