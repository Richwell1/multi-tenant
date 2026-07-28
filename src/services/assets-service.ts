import { z } from 'zod';
import { RepositoryError } from '@/data/errors';
import { assetsRepository, type CreateAssetInput } from '@/data/assets';

export const assetFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  assetTag: z.string().trim().max(60).optional(),
  assignedTo: z.string().trim().max(120).optional(),
});
export type AssetFormValues = z.infer<typeof assetFormSchema>;

export const assetsService = {
  list: (companyId: string) => assetsRepository.list(companyId),
  create: (companyId: string, input: AssetFormValues) => {
    const parsed = assetFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new RepositoryError(parsed.error.issues[0]?.message ?? 'Invalid asset', 'validation');
    }
    const payload: CreateAssetInput = {
      name: parsed.data.name,
      assetTag: parsed.data.assetTag?.trim() || undefined,
      assignedTo: parsed.data.assignedTo?.trim() || undefined,
    };
    return assetsRepository.create(companyId, payload);
  },
};
