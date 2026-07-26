import { useQuery } from '@tanstack/react-query';
import { healthService } from '@/services/health-service';
import { queryKeys } from '@/lib/query-keys';

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health.all, queryFn: () => healthService.list() });
}
