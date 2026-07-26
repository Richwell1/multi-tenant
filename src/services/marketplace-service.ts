// Extensions Marketplace service — company catalog + self-install + admin adoption.
import { RepositoryError } from '@/data/errors';
import { marketplaceRepository } from '@/data/marketplace';

export const marketplaceService = {
  list: () => marketplaceRepository.list(),
  install: (packageKey: string) => {
    if (!packageKey) throw new RepositoryError('Select a package to install.', 'validation');
    return marketplaceRepository.install(packageKey);
  },
  adoption: () => marketplaceRepository.adoption(),
};
