// ---------------------------------------------------------------------------
// Tenant + portal resolution.
//
// Package entitlements live in '@/lib/entitlements' + '@/hooks/entitlements'
// (sourced from the membership context), not here.
//
// Context is derived from the hostname and query string:
//   admin.<domain>              -> Platform Super Admin portal
//   /login?portal=admin         -> Platform Super Admin portal
//   /login?tenant=<company-slug> -> that company's workspace (dynamic)
//
// Company selection is driven by the dynamic `?tenant=<slug>` parameter — the
// slug of a company created through registration. Wildcard-subdomain tenant
// resolution is deferred, so no company slug is hardcoded here; unknown hosts
// default to the admin portal.
// ---------------------------------------------------------------------------

import type { Company, Portal } from '@/data/types';
import { companies } from '@/data/mock';

export interface ResolvedContext {
  portal: Portal;
  /** Tenant id when portal === 'company'; null for admin. */
  tenantId: string | null;
}

/**
 * Resolve portal + tenant from a hostname and optional query string.
 * The tenant is selected dynamically via `?tenant=<slug>`; no company identity
 * is hardcoded.
 */
export function resolveContext(hostname: string, search = ''): ResolvedContext {
  const params = new URLSearchParams(search);

  const portalParam = params.get('portal');
  if (portalParam === 'admin') return { portal: 'admin', tenantId: null };

  const tenantParam = params.get('tenant')?.trim().toLowerCase();
  if (tenantParam) {
    // Dynamic tenant resolution — supports any registration-created company slug.
    return { portal: 'company', tenantId: tenantParam };
  }

  const sub = hostname.split('.')[0]?.toLowerCase() ?? '';
  if (sub === 'admin') return { portal: 'admin', tenantId: null };

  // Wildcard-subdomain tenant resolution is deferred; unknown hosts default to
  // the admin portal. Companies are selected via `?tenant=<slug>`.
  return { portal: 'admin', tenantId: null };
}

export function getCompany(tenantId: string | null): Company | undefined {
  if (!tenantId) return undefined;
  return companies.find((c) => c.id === tenantId);
}
