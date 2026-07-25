// ---------------------------------------------------------------------------
// Company registration boundary types (provider-agnostic).
// ---------------------------------------------------------------------------

export interface RegisterCompanyInput {
  companyName: string;
  slug: string;
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
