import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { documentNotesRepository, type CreateDocumentNoteInput } from '@/data/document-notes';

export const documentNoteFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(60).optional(),
});
export type DocumentNoteFormValues = z.infer<typeof documentNoteFormSchema>;

export const documentNotesService = {
  list: (companyId: string) => documentNotesRepository.list(companyId),
  create: (companyId: string, input: DocumentNoteFormValues) => {
    const parsed = documentNoteFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid note', 'validation');
    }
    const payload: CreateDocumentNoteInput = {
      title: parsed.data.title,
      description: parsed.data.description?.trim() || undefined,
      category: parsed.data.category?.trim() || undefined,
    };
    return documentNotesRepository.create(companyId, payload);
  },
};
