// ---------------------------------------------------------------------------
// Membership / company-context domain types (provider-agnostic).
// ---------------------------------------------------------------------------

export type CompanyRole = 'company_admin' | 'company_user';
export type MembershipStatus = 'active' | 'inactive' | 'suspended';
export type CompanyStatus = 'active' | 'suspended';

export interface MembershipRecord {
  companyId: string;
  role: CompanyRole;
  status: MembershipStatus;
}

/** An enabled package plus the company's installed version (drives version gating). */
export interface EnabledPackage {
  code: string;
  version: string | null;
}

/** Everything a company-scoped route guard / workspace needs after sign-in. */
export interface CompanySessionContext {
  userId: string;
  companyId: string;
  /** Tenant identifier used in routing (company subdomain label). */
  companySlug: string;
  companyName: string;
  companyStatus: CompanyStatus;
  membershipStatus: MembershipStatus;
  role: CompanyRole;
  /** Enabled packages with installed versions (single source for version gating). */
  enabledPackages: EnabledPackage[];
  /** Convenience: just the enabled package codes (derived from `enabledPackages`). */
  enabledPackageCodes: string[];
}
