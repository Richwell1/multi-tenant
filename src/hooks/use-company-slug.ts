import { useParams } from '@tanstack/react-router';
import { useSessionOptional } from '@/lib/session';

/**
 * The company slug for the current workspace route — the ROUTING identifier in
 * `/:companySlug/...` (dev) or implied by the tenant subdomain (production,
 * pathless workspace layout — see router.tsx). It is used only to build links
 * and read the active tenant segment; it never stands in for the company UUID,
 * membership, entitlement, or RLS checks (those remain the security boundary,
 * resolved from the membership context). Falls back to the session's
 * hostname-resolved tenantId when there is no `$companySlug` path param (the
 * production/pathless case); returns '' outside the workspace entirely (or
 * outside a SessionProvider, e.g. a unit test rendering a page in isolation).
 */
export function useCompanySlug(): string {
  const params = useParams({ strict: false }) as { companySlug?: string };
  const tenantId = useSessionOptional()?.tenantId;
  return params.companySlug ?? tenantId ?? '';
}
