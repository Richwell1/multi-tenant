import { useParams } from '@tanstack/react-router';

/**
 * The company slug for the current workspace route — the ROUTING identifier in
 * `/:companySlug/...`. It is used only to build links and read the active tenant
 * segment; it never stands in for the company UUID, membership, entitlement, or
 * RLS checks (those remain the security boundary, resolved from the membership
 * context). Only ever called within the `/$companySlug` subtree, where the param
 * is always present; returns '' otherwise.
 */
export function useCompanySlug(): string {
  const params = useParams({ strict: false }) as { companySlug?: string };
  return params.companySlug ?? '';
}
