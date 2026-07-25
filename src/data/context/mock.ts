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
import type { CompanyRole, CompanySessionContext, MembershipRecord, MembershipStatus } from './types';

const COMPANY_NAME: Record<string, string> = {
  alpha: 'Alpha Trading',
  beta: 'Beta Manufacturing',
  gamma: 'Gamma Logistics',
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
    return {
      userId: user.id,
      companyId: `mock-${slug}`,
      companySlug: slug,
      companyName: COMPANY_NAME[slug],
      companyStatus: slug === 'gamma' ? 'suspended' : 'active',
      membershipStatus: membershipStatusFromEmail(user.email),
      role: roleFromEmail(user.email),
      enabledPackageCodes: slug === 'alpha' ? ['hr-core', 'leave-management'] : ['hr-core'],
    };
  }
}
