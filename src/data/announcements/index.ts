// Company Announcements — a marketplace feature (list + create). Entitlement +
// RLS are the real boundary; the mock adapter simulates writes for the demo.
import { resolveDataSource } from '@/data/repository';

export interface Announcement {
  id: string;
  companyId: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body?: string;
}

export interface AnnouncementsRepository {
  list(companyId: string): Promise<Announcement[]>;
  create(companyId: string, input: CreateAnnouncementInput): Promise<Announcement>;
}

class MockAnnouncementsRepository implements AnnouncementsRepository {
  private items = new Map<string, Announcement[]>();
  async list(companyId: string): Promise<Announcement[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.items.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateAnnouncementInput): Promise<Announcement> {
    await new Promise((r) => setTimeout(r, 200));
    const item: Announcement = {
      id: `an-${Date.now()}`,
      companyId,
      title: input.title,
      body: input.body ?? '',
      createdAt: new Date().toISOString(),
    };
    this.items.set(companyId, [item, ...(this.items.get(companyId) ?? [])]);
    return item;
  }
}

class LazySupabaseAnnouncementsRepository implements AnnouncementsRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseAnnouncementsRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateAnnouncementInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createAnnouncementsRepository(source = resolveDataSource()): AnnouncementsRepository {
  return source === 'supabase' ? new LazySupabaseAnnouncementsRepository() : new MockAnnouncementsRepository();
}

export const announcementsRepository: AnnouncementsRepository = createAnnouncementsRepository();
