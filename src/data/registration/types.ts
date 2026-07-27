// ---------------------------------------------------------------------------
// Company registration boundary types (provider-agnostic).
// ---------------------------------------------------------------------------

export interface RegisterCompanyInput {
  companyName: string;
  /**
   * Optional user-chosen workspace slug. When present it is validated and must
   * be unique (never auto-suffixed). When omitted, the backend derives a unique
   * slug from the company name — the backend is authoritative for the final slug.
   */
  slug?: string;
  requestedSubdomain?: string;
  adminName?: string;
  email: string;
  password: string;
  phone?: string;
}

export interface RegisterCompanyResult {
  companyId: string;
  slug: string;
  subdomain: string;
  role: 'company_admin';
  hrCore: { packageKey: string; version: string };
}

/**
 * Result of a pre-submit slug availability check.
 * `verified` distinguishes an authoritative answer (mock/demo backend) from a
 * best-effort format check that will only be confirmed on submit (hosted, where
 * uniqueness is enforced transactionally by the Edge Function).
 */
export interface SlugAvailability {
  slug: string;
  available: boolean;
  verified: boolean;
}
