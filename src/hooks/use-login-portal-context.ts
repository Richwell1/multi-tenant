import { useMemo } from 'react';
import { useSession } from '@/lib/session';
import { resolveLoginPortalContext, type LoginPortalContext } from '@/lib/portal-context';

/**
 * The login page's single source for portal context. Reads the already-resolved
 * session (which centralizes hostname / ?portal= / ?tenant= handling) and maps
 * it to the typed {@link LoginPortalContext}.
 */
export function useLoginPortalContext(): LoginPortalContext {
  const { portal, company, tenantId } = useSession();
  return useMemo(
    () => resolveLoginPortalContext(portal, company, tenantId),
    [portal, company, tenantId],
  );
}
