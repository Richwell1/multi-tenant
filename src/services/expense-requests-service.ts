import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { expenseRequestsRepository } from '@/data/expense-requests';

export const expenseRequestFormSchema = z.object({
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  description: z.string().trim().max(500).optional(),
});
export type ExpenseRequestFormValues = z.infer<typeof expenseRequestFormSchema>;

export const expenseRequestsService = {
  list: (companyId: string) => expenseRequestsRepository.list(companyId),
  create: (companyId: string, input: ExpenseRequestFormValues) => {
    const parsed = expenseRequestFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid request', 'validation');
    }
    return expenseRequestsRepository.create(companyId, {
      amount: parsed.data.amount,
      description: parsed.data.description?.trim() || undefined,
    });
  },
};
