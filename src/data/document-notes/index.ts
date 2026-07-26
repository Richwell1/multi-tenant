// Document Notes — a minimal marketplace feature (list + create). Entitlement +
// RLS are the real boundary; the mock adapter simulates writes.
import { resolveDataSource } from '@/data/repository';

export interface DocumentNote {
  id: string;
  companyId: string;
  title: string;
  description: string;
  /** Available from Document Notes 1.1.0 onward. */
  category: string | null;
  createdAt: string;
}

export interface CreateDocumentNoteInput {
  title: string;
  description?: string;
  category?: string;
}

export interface DocumentNotesRepository {
  list(companyId: string): Promise<DocumentNote[]>;
  create(companyId: string, input: CreateDocumentNoteInput): Promise<DocumentNote>;
}

class MockDocumentNotesRepository implements DocumentNotesRepository {
  private notes = new Map<string, DocumentNote[]>();
  async list(companyId: string): Promise<DocumentNote[]> {
    await new Promise((r) => setTimeout(r, 200));
    return [...(this.notes.get(companyId) ?? [])];
  }
  async create(companyId: string, input: CreateDocumentNoteInput): Promise<DocumentNote> {
    await new Promise((r) => setTimeout(r, 200));
    const note: DocumentNote = {
      id: `dn-${Date.now()}`,
      companyId,
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? null,
      createdAt: new Date().toISOString(),
    };
    this.notes.set(companyId, [note, ...(this.notes.get(companyId) ?? [])]);
    return note;
  }
}

class LazySupabaseDocumentNotesRepository implements DocumentNotesRepository {
  private impl = () => import('./supabase').then((m) => new m.SupabaseDocumentNotesRepository());
  list = (companyId: string) => this.impl().then((r) => r.list(companyId));
  create = (companyId: string, input: CreateDocumentNoteInput) => this.impl().then((r) => r.create(companyId, input));
}

export function createDocumentNotesRepository(source = resolveDataSource()): DocumentNotesRepository {
  return source === 'supabase' ? new LazySupabaseDocumentNotesRepository() : new MockDocumentNotesRepository();
}

export const documentNotesRepository: DocumentNotesRepository = createDocumentNotesRepository();
