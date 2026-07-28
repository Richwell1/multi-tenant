import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { pulseSurveysRepository, type CreatePulseSurveyInput } from '@/data/pulse-surveys';

export const pulseSurveyFormSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(200),
  description: z.string().trim().max(1000).optional(),
});
export type PulseSurveyFormValues = z.infer<typeof pulseSurveyFormSchema>;

export const pulseSurveysService = {
  list: (companyId: string) => pulseSurveysRepository.list(companyId),
  create: (companyId: string, input: PulseSurveyFormValues) => {
    const parsed = pulseSurveyFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid survey', 'validation');
    }
    const payload: CreatePulseSurveyInput = {
      question: parsed.data.question,
      description: parsed.data.description?.trim() || undefined,
    };
    return pulseSurveysRepository.create(companyId, payload);
  },
};
