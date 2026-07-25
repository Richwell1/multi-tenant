import type { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useSession } from '@/lib/session';
import { useCompanyContext } from '@/hooks/context';
import { validateMembershipForTenant, type MembershipInfo } from '@/lib/guards';
import { PageLoadingState } from '@/components/states';

/**
 * Guards company routes: requires an authenticated session, an active membership
 * whose company matches the requested tenant, and an active company.
 *   unauthenticated  → tenant login
 *   tenant mismatch / inactive membership → access-denied
 *   suspended company → company-suspended
 */
export function CompanyGuard({ children }: { children: ReactNode }) {
  const { authenticated, authLoading, user, tenantId } = useSession();
  const contextQuery = useCompanyContext();

  if (authLoading) return <PageLoadingState label="Loading workspace…" />;
  if (!authenticated || !user) {
    return <Navigate to="/login" search={{ tenant: tenantId ?? undefined }} />;
  }
  if (contextQuery.isPending) return <PageLoadingState label="Loading workspace…" />;

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
    requestedTenantSlug: tenantId ?? '',
    membership,
  });

  if (outcome === 'company-suspended') return <Navigate to="/company-suspended" />;
  if (outcome !== 'allow') return <Navigate to="/access-denied" />;

  return <>{children}</>;
}
