import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { onboardingChecklistRepository } from '@/data/onboarding-checklist';

export const checklistItemFormSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(160),
});
export type ChecklistItemFormValues = z.infer<typeof checklistItemFormSchema>;

export const onboardingChecklistService = {
  list: (companyId: string) => onboardingChecklistRepository.list(companyId),
  create: (companyId: string, input: ChecklistItemFormValues) => {
    const parsed = checklistItemFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid item', 'validation');
    }
    return onboardingChecklistRepository.create(companyId, { label: parsed.data.label });
  },
  setDone: (companyId: string, id: string, done: boolean) =>
    onboardingChecklistRepository.setDone(companyId, id, done),
};
