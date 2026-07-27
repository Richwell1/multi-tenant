import type { ReactNode } from 'react';
import { Navigate, useParams } from '@tanstack/react-router';
import { useSession } from '@/lib/session';
import { useCompanyContext } from '@/hooks/context';
import { validateMembershipForTenant, type MembershipInfo } from '@/lib/guards';
import { ErrorState, PageLoadingState } from '@/components/states';

/**
 * Guards company routes: requires an authenticated session, an active membership
 * whose company matches the requested tenant, and an active company. The tenant
 * is the `/:companySlug` route segment — a routing identifier that must match the
 * authenticated membership; it never replaces the company UUID + RLS boundary.
 *   unauthenticated  → tenant login (slug pre-filled)
 *   tenant mismatch / inactive membership → access-denied
 *   suspended company → company-suspended
 */
export function CompanyGuard({ children }: { children: ReactNode }) {
  const { authenticated, authLoading, user, tenantId } = useSession();
  const params = useParams({ strict: false }) as { companySlug?: string };
  // The URL slug is the requested tenant; fall back to session tenant only if a
  // guard ever renders outside the `/$companySlug` subtree.
  const requestedSlug = params.companySlug ?? tenantId ?? '';
  const contextQuery = useCompanyContext();

  if (authLoading) return <PageLoadingState label="Loading workspace…" />;
  if (!authenticated || !user) {
    return <Navigate to="/login" search={{ tenant: requestedSlug || undefined }} />;
  }
  if (contextQuery.isPending) return <PageLoadingState label="Loading workspace…" />;
  if (contextQuery.isError) {
    return (
      <ErrorState
        title="Couldn’t load workspace access"
        description="We could not verify your company membership."
        onRetry={() => contextQuery.refetch()}
        retrying={contextQuery.isFetching}
      />
    );
  }

  const ctx = contextQuery.data;
  const membership: MembershipInfo | null = ctx
    ? {
        companySlug: ctx.companySlug,
        membershipStatus: ctx.membershipStatus === 'active' ? 'active' : 'inactive',
        companyStatus: ctx.companyStatus,
        role: ctx.role,
      }
    : null;

  const outcome = validateMembershipForTenant({
    authenticated: true,
    // The `/:companySlug` segment is the requested tenant. If it is absent
    // (guard rendered outside the workspace subtree), the membership slug stands
    // in so a legitimately authenticated member is never spuriously denied.
    requestedTenantSlug: requestedSlug || membership?.companySlug || '',
    membership,
  });

  if (outcome === 'company-suspended') return <Navigate to="/company-suspended" />;
  if (outcome !== 'allow') return <Navigate to="/access-denied" />;

  return <>{children}</>;
}
