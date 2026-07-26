import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { visitorRegisterRepository } from '@/data/visitor-register';

export const visitorFormSchema = z.object({
  visitorName: z.string().trim().min(1, 'Visitor name is required').max(120),
  visitPurpose: z.string().trim().max(200).optional(),
});
export type VisitorFormValues = z.infer<typeof visitorFormSchema>;

export const visitorRegisterService = {
  list: (companyId: string) => visitorRegisterRepository.list(companyId),
  create: (companyId: string, input: VisitorFormValues) => {
    const parsed = visitorFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid visitor', 'validation');
    }
    return visitorRegisterRepository.create(companyId, {
      visitorName: parsed.data.visitorName,
      visitPurpose: parsed.data.visitPurpose?.trim() || undefined,
    });
  },
};
