import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized QueryClient configuration for the demo. Intentional defaults —
 * data is cached for 30s before being considered stale, kept 5min in memory,
 * one retry on transient failure, no refetch on window focus (noisy for a demo)
 * but do refetch when the connection is restored. Mutations never auto-retry.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
