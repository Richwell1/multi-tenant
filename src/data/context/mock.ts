// ---------------------------------------------------------------------------
// Mock context adapters — deterministic from the signed-in email so the demo
// and tests are predictable without a backend:
//   email contains "beta"/"gamma" -> that tenant, else "alpha"
//   contains "user"      -> company_user (else company_admin)
//   contains "inactive"  -> inactive membership
//   gamma tenant         -> suspended company
//   platform admin       -> NOT a company/user/employee email
// ---------------------------------------------------------------------------

import type { AuthUser } from '@/data/auth';
import type {
  CompanyContextRepository,
  MembershipRepository,
  PlatformAdminRepository,
} from './repositories';
import type {
  CompanyBySlug,
  CompanyRole,
  CompanySessionContext,
  CompanyStatus,
  EnabledPackage,
  MembershipRecord,
  MembershipStatus,
} from './types';

const COMPANY_NAME: Record<string, string> = {
  alpha: 'Alpha Trading',
  beta: 'Beta Manufacturing',
  gamma: 'Gamma Logistics',
};

// Deterministic demo entitlements with installed versions. Alpha is on HR Core
// 1.1.0 (Employees available) + Leave; Beta is still on HR Core 1.0.0 (Employees
// hidden) to illustrate version gating locally. This is fixture data, not gating
// logic — the gate itself never branches on company identity.
const ENABLED_PACKAGES: Record<string, EnabledPackage[]> = {
  alpha: [
    { code: 'hr-core', version: '1.1.0' },
    { code: 'leave-management', version: '1.0.0' },
    // Org Chart Viewer is a platform-pushed System Tool (not marketplace-installed).
    { code: 'org-chart', version: '1.0.0' },
    // Custom Onboarding Checklist is a private extension assigned to this company.
    { code: 'custom-onboarding-checklist', version: '1.0.0' },
    // Bulk Data Importer is a platform-pushed System Tool.
    { code: 'bulk-importer', version: '1.0.0' },
  ],
  beta: [{ code: 'hr-core', version: '1.0.0' }],
  gamma: [{ code: 'hr-core', version: '1.0.0' }],
};

function slugFromEmail(email: string): 'alpha' | 'beta' | 'gamma' {
  const e = email.toLowerCase();
  if (e.includes('beta')) return 'beta';
  if (e.includes('gamma')) return 'gamma';
  return 'alpha';
}

function roleFromEmail(email: string): CompanyRole {
  return email.toLowerCase().includes('user') ? 'company_user' : 'company_admin';
}

function membershipStatusFromEmail(email: string): MembershipStatus {
  return email.toLowerCase().includes('inactive') ? 'inactive' : 'active';
}

export class MockPlatformAdminRepository implements PlatformAdminRepository {
  async isPlatformAdmin(user: AuthUser): Promise<boolean> {
    const e = user.email.toLowerCase();
    // A company/tenant user is not a platform admin; other emails are (demo).
    return !e.includes('company') && !e.includes('employee') && !e.includes('user');
  }
}

export class MockMembershipRepository implements MembershipRepository {
  async getActiveMembership(user: AuthUser): Promise<MembershipRecord | null> {
    const status = membershipStatusFromEmail(user.email);
    if (status !== 'active') return null;
    return {
      companyId: `mock-${slugFromEmail(user.email)}`,
      role: roleFromEmail(user.email),
      status,
    };
  }
}

export class MockCompanyContextRepository implements CompanyContextRepository {
  async getCompanyContext(user: AuthUser): Promise<CompanySessionContext | null> {
    const slug = slugFromEmail(user.email);
    const enabledPackages = ENABLED_PACKAGES[slug] ?? [];
    return {
      userId: user.id,
      companyId: `mock-${slug}`,
      companySlug: slug,
      companyName: COMPANY_NAME[slug],
      companyStatus: slug === 'gamma' ? 'suspended' : 'active',
      membershipStatus: membershipStatusFromEmail(user.email),
      role: roleFromEmail(user.email),
      enabledPackages,
      enabledPackageCodes: enabledPackages.map((p) => p.code),
    };
  }

  /** Resolve one of the demo tenants by slug (normalized). Unknown → null. */
  async findCompanyBySlug(slug: string): Promise<CompanyBySlug | null> {
    const normalized = slug.trim().toLowerCase();
    const name = COMPANY_NAME[normalized];
    if (!name) return null;
    const status: CompanyStatus = normalized === 'gamma' ? 'suspended' : 'active';
    return { companyId: `mock-${normalized}`, companySlug: normalized, companyName: name, companyStatus: status };
  }
}
