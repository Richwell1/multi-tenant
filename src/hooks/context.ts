import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/session';
import { queryKeys } from '@/lib/query-keys';
import { companyContextRepository, platformAdminRepository } from '@/data/context';

/** Resolve whether the signed-in user is an active platform admin. */
export function usePlatformAdmin() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.context.platformAdmin(user?.id ?? 'anon'),
    queryFn: () => platformAdminRepository.isPlatformAdmin(user!),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

/** Resolve the signed-in user's company session context (membership + company). */
export function useCompanyContext() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.context.company(user?.id ?? 'anon'),
    queryFn: () => companyContextRepository.getCompanyContext(user!),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}
