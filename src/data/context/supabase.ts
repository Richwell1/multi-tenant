// ---------------------------------------------------------------------------
// Supabase context adapters. Query membership/company/entitlements and
// platform_admins via the browser client (RLS-protected). Loaded lazily (see
// index.ts) so the SDK stays out of the default bundle.
// ---------------------------------------------------------------------------

import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { AuthUser } from '@/data/auth';
import type {
  CompanyContextRepository,
  MembershipRepository,
  PlatformAdminRepository,
} from './repositories';
import type {
  CompanyRole,
  CompanySessionContext,
  CompanyStatus,
  MembershipRecord,
  MembershipStatus,
} from './types';

interface MembershipRow {
  company_id: string;
  role: CompanyRole;
  status: MembershipStatus;
  companies: { name: string; subdomain: string | null; status: CompanyStatus } | null;
}
interface PackageRow {
  package_key: string;
  package_version: string | null;
  packages: { is_active: boolean } | null;
}

export class SupabasePlatformAdminRepository implements PlatformAdminRepository {
  async isPlatformAdmin(user: AuthUser): Promise<boolean> {
    const { data, error } = await getSupabaseClient()
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return !!data;
  }
}

export class SupabaseMembershipRepository implements MembershipRepository {
  async getActiveMembership(user: AuthUser): Promise<MembershipRecord | null> {
    const { data, error } = await getSupabaseClient()
      .from('company_memberships')
      .select('company_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    const row = data as unknown as { company_id: string; role: CompanyRole; status: MembershipStatus };
    return { companyId: row.company_id, role: row.role, status: row.status };
  }
}

export class SupabaseCompanyContextRepository implements CompanyContextRepository {
  async getCompanyContext(user: AuthUser): Promise<CompanySessionContext | null> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('company_memberships')
      .select('company_id, role, status, companies(name, subdomain, status)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (!data) return null;
    const m = data as unknown as MembershipRow;
    if (!m.companies) return null;

    const { data: pkgData, error: pkgError } = await client
      .from('company_packages')
      .select('package_key, package_version, packages!inner(is_active)')
      .eq('company_id', m.company_id)
      .eq('enabled', true);
    if (pkgError) throw mapSupabaseError(pkgError);
    const enabledPackages = ((pkgData ?? []) as unknown as PackageRow[])
      .filter((p) => p.packages?.is_active)
      .map((p) => ({ code: p.package_key, version: p.package_version }));

    return {
      userId: user.id,
      companyId: m.company_id,
      companySlug: m.companies.subdomain ?? '',
      companyName: m.companies.name,
      companyStatus: m.companies.status,
      membershipStatus: m.status,
      role: m.role,
      enabledPackages,
      enabledPackageCodes: enabledPackages.map((p) => p.code),
    };
  }
}
