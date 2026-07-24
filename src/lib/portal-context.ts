// ---------------------------------------------------------------------------
// Single typed resolver for the login portal context. The login page consumes
// the resolved discriminated union; no component checks `search.portal === ...`
// on its own. Registration visibility is a property of the context, not an
// ad-hoc conditional scattered across the UI.
// ---------------------------------------------------------------------------

import type { Company, Portal } from '@/data/types';

export type LoginPortalContext =
  | {
      type: 'platform_admin';
      name: 'Platform Administration';
      showRegistration: false;
    }
  | {
      type: 'company';
      tenantSlug: string;
      companyName: string;
      showRegistration: true;
    };

/**
 * Map a resolved session (portal + optional company) to the typed login
 * context. Kept pure so it can be unit tested without React.
 */
export function resolveLoginPortalContext(
  portal: Portal,
  company: Company | undefined,
  tenantId: string | null,
): LoginPortalContext {
  if (portal === 'admin') {
    return { type: 'platform_admin', name: 'Platform Administration', showRegistration: false };
  }
  return {
    type: 'company',
    tenantSlug: company?.slug ?? tenantId ?? 'company',
    companyName: company?.name ?? 'Company Workspace',
    showRegistration: true,
  };
}
