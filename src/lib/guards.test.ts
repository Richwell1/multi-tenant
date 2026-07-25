import { describe, it, expect } from 'vitest';
import {
  evaluatePlatformAccess,
  validateMembershipForTenant,
  resolveTenantContext,
  type MembershipInfo,
} from './guards';

describe('evaluatePlatformAccess', () => {
  it('unauthenticated → unauthenticated', () => {
    expect(evaluatePlatformAccess({ authenticated: false, isPlatformAdmin: false })).toBe('unauthenticated');
  });
  it('non-admin → access-denied', () => {
    expect(evaluatePlatformAccess({ authenticated: true, isPlatformAdmin: false })).toBe('access-denied');
  });
  it('platform admin → allow', () => {
    expect(evaluatePlatformAccess({ authenticated: true, isPlatformAdmin: true })).toBe('allow');
  });
});

const alpha: MembershipInfo = {
  companySlug: 'alpha',
  membershipStatus: 'active',
  companyStatus: 'active',
  role: 'company_admin',
};

describe('validateMembershipForTenant', () => {
  it('active Alpha member on tenant=alpha → allow', () => {
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: alpha })).toBe('allow');
  });
  it('unauthenticated → unauthenticated', () => {
    expect(validateMembershipForTenant({ authenticated: false, requestedTenantSlug: 'alpha', membership: alpha })).toBe('unauthenticated');
  });
  it('no membership → access-denied', () => {
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: null })).toBe('access-denied');
  });
  it('Beta member opening tenant=alpha → access-denied (mismatch)', () => {
    const beta: MembershipInfo = { ...alpha, companySlug: 'beta' };
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: beta })).toBe('access-denied');
  });
  it('inactive membership → access-denied', () => {
    const inactive: MembershipInfo = { ...alpha, membershipStatus: 'inactive' };
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: inactive })).toBe('access-denied');
  });
  it('suspended company (own tenant) → company-suspended', () => {
    const suspended: MembershipInfo = { ...alpha, companyStatus: 'suspended' };
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: suspended })).toBe('company-suspended');
  });
  it('mismatch is denied before revealing another tenant’s suspension', () => {
    const betaSuspended: MembershipInfo = { ...alpha, companySlug: 'beta', companyStatus: 'suspended' };
    expect(validateMembershipForTenant({ authenticated: true, requestedTenantSlug: 'alpha', membership: betaSuspended })).toBe('access-denied');
  });
});

describe('resolveTenantContext', () => {
  it('company subdomain yields the tenant slug', () => {
    expect(resolveTenantContext('alpha.multi-tenants-hr.com')).toEqual({ tenantSlug: 'alpha' });
  });
  it('admin context yields no tenant', () => {
    expect(resolveTenantContext('admin.multi-tenants-hr.com')).toEqual({ tenantSlug: null });
  });
  it('local dev ?tenant=beta yields beta', () => {
    expect(resolveTenantContext('localhost', '?tenant=beta')).toEqual({ tenantSlug: 'beta' });
  });
});
