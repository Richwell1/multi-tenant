import { useSession } from '@/lib/session';
import { useCompanyContext } from '@/hooks/context';
import { resolveDataSource } from '@/data/repository';

/**
 * The effective company identifier for tenant-owned queries:
 *   mock     → the resolved tenant slug (e.g. "alpha")
 *   supabase → the real company UUID from the membership context
 * Keeps pages/hooks source-agnostic (no data-source branching in components).
 */
export function useCompanyId(): string | undefined {
  const { tenantId } = useSession();
  const context = useCompanyContext();
  return resolveDataSource() === 'supabase'
    ? context.data?.companyId
    : (tenantId ?? context.data?.companySlug);
}
