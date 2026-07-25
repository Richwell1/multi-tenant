import { healthRepository } from '@/data/health';

export const healthService = {
  list: () => healthRepository.list(),
};
