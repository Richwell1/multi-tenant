// ---------------------------------------------------------------------------
// Typed context boundaries (dependency inversion). Guards/hooks depend on these
// interfaces, not on Supabase.
// ---------------------------------------------------------------------------

import type { AuthUser } from '@/data/auth';
import type { CompanyBySlug, CompanySessionContext, MembershipRecord } from './types';

export interface PlatformAdminRepository {
  isPlatformAdmin(user: AuthUser): Promise<boolean>;
}

export interface MembershipRepository {
  /** The user's single ACTIVE membership, or null. */
  getActiveMembership(user: AuthUser): Promise<MembershipRecord | null>;
}

export interface CompanyContextRepository {
  /** Full company session context (membership + company + entitlements). */
  getCompanyContext(user: AuthUser): Promise<CompanySessionContext | null>;
  /**
   * Resolve safe public metadata for a company by its routing slug. Normalizes
   * the slug; returns null when it does not resolve for the caller. RLS is the
   * boundary — this never exposes companies the caller is not a member of, and
   * is never a substitute for membership verification.
   */
  findCompanyBySlug(slug: string): Promise<CompanyBySlug | null>;
}
