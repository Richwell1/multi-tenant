import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { announcementsRepository, type CreateAnnouncementInput } from '@/data/announcements';

export const announcementFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  body: z.string().trim().max(2000).optional(),
});
export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

export const announcementsService = {
  list: (companyId: string) => announcementsRepository.list(companyId),
  create: (companyId: string, input: AnnouncementFormValues) => {
    const parsed = announcementFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid announcement', 'validation');
    }
    const payload: CreateAnnouncementInput = {
      title: parsed.data.title,
      body: parsed.data.body?.trim() || undefined,
    };
    return announcementsRepository.create(companyId, payload);
  },
};
