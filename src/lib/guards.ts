// ---------------------------------------------------------------------------
// Centralized authorization guards. Pure functions so portal/tenant/membership
// decisions live in ONE place and are unit-tested, never scattered across pages.
//
// NOTE: these are UX guards. The authoritative boundary is Supabase RLS +
// the service-role-only onboarding function — never these client checks.
// ---------------------------------------------------------------------------

import { resolveContext, type ResolvedContext } from './tenant';

export type GuardOutcome = 'allow' | 'unauthenticated' | 'access-denied' | 'company-suspended';

/** Portal + tenant resolution from the current location (thin, reused). */
export function resolvePortalContext(hostname: string, search = ''): ResolvedContext {
  return resolveContext(hostname, search);
}

export interface TenantContext {
  tenantSlug: string | null;
}
export function resolveTenantContext(hostname: string, search = ''): TenantContext {
  const ctx = resolveContext(hostname, search);
  return { tenantSlug: ctx.portal === 'company' ? ctx.tenantId : null };
}

// --- Platform access ---------------------------------------------------------
export interface PlatformAccessInput {
  authenticated: boolean;
  isPlatformAdmin: boolean;
}
export function evaluatePlatformAccess({ authenticated, isPlatformAdmin }: PlatformAccessInput): GuardOutcome {
  if (!authenticated) return 'unauthenticated';
  return isPlatformAdmin ? 'allow' : 'access-denied';
}

// --- Company access ----------------------------------------------------------
export interface MembershipInfo {
  /** The tenant identifier used in routing (the company subdomain label). */
  companySlug: string;
  membershipStatus: 'active' | 'inactive';
  companyStatus: 'active' | 'suspended';
  role: 'company_admin' | 'company_user';
}
export interface CompanyAccessInput {
  authenticated: boolean;
  requestedTenantSlug: string;
  membership: MembershipInfo | null;
}

/**
 * Decide whether a user may enter the requested company workspace.
 * Order matters: mismatch is denied BEFORE revealing suspension of another tenant.
 */
export function validateMembershipForTenant({
  authenticated,
  requestedTenantSlug,
  membership,
}: CompanyAccessInput): GuardOutcome {
  if (!authenticated) return 'unauthenticated';
  if (!membership) return 'access-denied';
  if (membership.membershipStatus !== 'active') return 'access-denied';
  if (membership.companySlug !== requestedTenantSlug) return 'access-denied';
  if (membership.companyStatus === 'suspended') return 'company-suspended';
  return 'allow';
}
