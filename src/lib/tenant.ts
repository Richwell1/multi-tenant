// ---------------------------------------------------------------------------
// Tenant + portal resolution and package gating.
//
// Context is derived from the hostname:
//   admin.multi-tenants-hr.com  -> Platform Super Admin portal
//   alpha.multi-tenants-hr.com  -> Alpha Trading workspace
//   beta.multi-tenants-hr.com   -> Beta Manufacturing workspace
//
// For local dev the same context can be forced via query params:
//   /login?portal=admin
//   /login?tenant=alpha
//   /login?tenant=beta
// ---------------------------------------------------------------------------

import type { Company, PackageKey, Portal } from '@/data/types';
import { companies } from '@/data/mock';

export interface ResolvedContext {
  portal: Portal;
  /** Tenant id when portal === 'company'; null for admin. */
  tenantId: string | null;
}

const SUBDOMAIN_TO_TENANT: Record<string, string> = {
  alpha: 'alpha',
  beta: 'beta',
  gamma: 'gamma',
};

/**
 * Resolve portal + tenant from a hostname and optional query string.
 * Query params win in local development so subdomains are not required.
 */
export function resolveContext(hostname: string, search = ''): ResolvedContext {
  const params = new URLSearchParams(search);

  const portalParam = params.get('portal');
  if (portalParam === 'admin') return { portal: 'admin', tenantId: null };

  const tenantParam = params.get('tenant');
  if (tenantParam && SUBDOMAIN_TO_TENANT[tenantParam]) {
    return { portal: 'company', tenantId: SUBDOMAIN_TO_TENANT[tenantParam] };
  }

  const sub = hostname.split('.')[0]?.toLowerCase() ?? '';
  if (sub === 'admin') return { portal: 'admin', tenantId: null };
  if (SUBDOMAIN_TO_TENANT[sub]) {
    return { portal: 'company', tenantId: SUBDOMAIN_TO_TENANT[sub] };
  }

  // Default (bare localhost / unknown host) -> admin portal.
  return { portal: 'admin', tenantId: null };
}

export function getCompany(tenantId: string | null): Company | undefined {
  if (!tenantId) return undefined;
  return companies.find((c) => c.id === tenantId);
}

/** Package gating — backend-equivalent check the UI must respect. */
export function companyHasPackage(company: Company | undefined, key: PackageKey): boolean {
  if (!company) return false;
  return company.packages.includes(key);
}

/** Whether a tenant may access /leave. Beta must always be false. */
export function canAccessLeave(company: Company | undefined): boolean {
  return companyHasPackage(company, 'leave-management');
}

/** Whether a tenant may access /attendance. */
export function canAccessAttendance(company: Company | undefined): boolean {
  return companyHasPackage(company, 'attendance-management');
}
