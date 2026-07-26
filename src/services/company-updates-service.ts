import { RepositoryError } from '@/data/errors';
import { companyUpdatesRepository } from '@/data/company-updates';

export const companyUpdatesService = {
  list: (companyId: string) => companyUpdatesRepository.list(companyId),
  install: (installationId: string) => {
    if (!installationId) throw new RepositoryError('Select an update to install.', 'validation');
    return companyUpdatesRepository.install(installationId);
  },
};
