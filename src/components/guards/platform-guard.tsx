import type { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useSession } from '@/lib/session';
import { usePlatformAdmin } from '@/hooks/context';
import { evaluatePlatformAccess } from '@/lib/guards';
import { ErrorState, PageLoadingState } from '@/components/states';

/**
 * Guards /admin/*: requires an authenticated session AND an active platform_admin
 * record. Unauthenticated → admin login; authenticated non-admin → access-denied.
 */
export function PlatformGuard({ children }: { children: ReactNode }) {
  const { authenticated, authLoading, user } = useSession();
  const adminQuery = usePlatformAdmin();

  if (authLoading) return <PageLoadingState label="Checking access…" />;
  if (!authenticated || !user) return <Navigate to="/login" search={{ portal: 'admin' }} />;
  if (adminQuery.isPending) return <PageLoadingState label="Checking access…" />;
  if (adminQuery.isError) {
    return (
      <ErrorState
        title="Couldn’t verify admin access"
        description="We could not confirm your Platform Super Admin session."
        onRetry={() => adminQuery.refetch()}
        retrying={adminQuery.isFetching}
      />
    );
  }

  const outcome = evaluatePlatformAccess({ authenticated: true, isPlatformAdmin: !!adminQuery.data });
  if (outcome !== 'allow') return <Navigate to="/access-denied" />;

  return <>{children}</>;
}
