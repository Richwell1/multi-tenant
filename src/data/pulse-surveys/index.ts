// Pulse Surveys — a marketplace feature (list + create). Entitlement + RLS are
// the real boundary; the mock adapter simulates writes for the demo.
import { resolveDataSource } from '@/data/repository';

export type PulseSurveyStatus = 'active' | 'closed';

export interface PulseSurvey {
  id: string;
  companyId: string;
  question: string;
  description: string;
  status: PulseSurveyStatus;
  createdAt: string;
}

export interface CreatePulseSurveyInput {
  question: string;
  description?: string;
  status?: PulseSurveyStatus;
}

export interface PulseSurveysRepository {
  list(companyId: string): Promise<PulseSurvey[]>;
  create(companyId: string, input: CreatePulseSurveyInput): Promise<PulseSurvey>;
}

class MockPulseSurveysRepository implements PulseSurveysRepository {
  private items = new Map<string, PulseSurvey[]>();
  async list(companyId: string): Promise<PulseSurvey[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.items.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreatePulseSurveyInput): Promise<PulseSurvey> {
    await new Promise((r) => setTimeout(r, 200));
    const item: PulseSurvey = {
      id: `ps-${Date.now()}`,
      companyId,
      question: input.question,
      description: input.description ?? '',
      status: input.status ?? 'active',
      createdAt: new Date().toISOString(),
    };
    this.items.set(companyId, [item, ...(this.items.get(companyId) ?? [])]);
    return item;
  }
}

class LazySupabasePulseSurveysRepository implements PulseSurveysRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabasePulseSurveysRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreatePulseSurveyInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createPulseSurveysRepository(source = resolveDataSource()): PulseSurveysRepository {
  return source === 'supabase' ? new LazySupabasePulseSurveysRepository() : new MockPulseSurveysRepository();
}

export const pulseSurveysRepository: PulseSurveysRepository = createPulseSurveysRepository();
