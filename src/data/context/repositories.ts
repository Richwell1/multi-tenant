// ---------------------------------------------------------------------------
// Typed context boundaries (dependency inversion). Guards/hooks depend on these
// interfaces, not on Supabase.
// ---------------------------------------------------------------------------

import type { AuthUser } from '@/data/auth';
import type { CompanySessionContext, MembershipRecord } from './types';

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
}
