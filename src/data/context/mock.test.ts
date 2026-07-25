import { describe, it, expect } from 'vitest';
import {
  MockCompanyContextRepository,
  MockMembershipRepository,
  MockPlatformAdminRepository,
} from './mock';

const user = (email: string) => ({ id: `mock-${email}`, email });

describe('MockPlatformAdminRepository', () => {
  const repo = new MockPlatformAdminRepository();
  it('treats generic/admin emails as platform admins', async () => {
    expect(await repo.isPlatformAdmin(user('super@platform.test'))).toBe(true);
  });
  it('treats company/user emails as non-admins', async () => {
    expect(await repo.isPlatformAdmin(user('company-user@x.test'))).toBe(false);
    expect(await repo.isPlatformAdmin(user('employee@x.test'))).toBe(false);
  });
});

describe('MockCompanyContextRepository', () => {
  const repo = new MockCompanyContextRepository();
  it('resolves Alpha with Leave entitlement', async () => {
    const ctx = await repo.getCompanyContext(user('admin@alpha.test'));
    expect(ctx).toMatchObject({ companySlug: 'alpha', companyStatus: 'active', role: 'company_admin' });
    expect(ctx?.enabledPackageCodes).toContain('leave-management');
  });
  it('resolves Beta as core-only', async () => {
    const ctx = await repo.getCompanyContext(user('admin@beta.test'));
    expect(ctx?.companySlug).toBe('beta');
    expect(ctx?.enabledPackageCodes).not.toContain('leave-management');
  });
  it('resolves Gamma as suspended', async () => {
    const ctx = await repo.getCompanyContext(user('admin@gamma.test'));
    expect(ctx?.companyStatus).toBe('suspended');
  });
  it('marks inactive members and lowers company_user role', async () => {
    const inactive = await repo.getCompanyContext(user('inactive@alpha.test'));
    expect(inactive?.membershipStatus).toBe('inactive');
    const normal = await repo.getCompanyContext(user('user@alpha.test'));
    expect(normal?.role).toBe('company_user');
  });
});

describe('MockMembershipRepository', () => {
  const repo = new MockMembershipRepository();
  it('returns an active membership for active users', async () => {
    expect(await repo.getActiveMembership(user('admin@alpha.test'))).toMatchObject({ status: 'active' });
  });
  it('returns null for inactive users', async () => {
    expect(await repo.getActiveMembership(user('inactive@alpha.test'))).toBeNull();
  });
});
