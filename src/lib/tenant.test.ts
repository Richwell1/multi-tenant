import { describe, it, expect } from 'vitest';
import { resolveContext, getCompany } from './tenant';

describe('context resolution', () => {
  it('resolves admin from admin subdomain', () => {
    expect(resolveContext('admin.multi-tenants-hr.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('does not resolve a tenant from a bare company subdomain (wildcard subdomains deferred)', () => {
    // No company slug is hardcoded; a subdomain alone defaults to admin.
    expect(resolveContext('anycompany.multi-tenants-hr.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('supports local dev ?portal=admin', () => {
    expect(resolveContext('localhost', '?portal=admin')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves any dynamically-created tenant slug via ?tenant=', () => {
    expect(resolveContext('localhost', '?tenant=acme')).toEqual({ portal: 'company', tenantId: 'acme' });
    expect(resolveContext('localhost', '?tenant=other-co')).toEqual({ portal: 'company', tenantId: 'other-co' });
  });

  it('supports production-created tenant slugs on the hosted domain', () => {
    expect(resolveContext('multi-tenant-hr.vercel.app', '?tenant=rich')).toEqual({
      portal: 'company',
      tenantId: 'rich',
    });
  });
  it('defaults bare localhost to admin', () => {
    expect(resolveContext('localhost')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('getCompany returns undefined for admin (null tenant)', () => {
    expect(getCompany(null)).toBeUndefined();
  });
});
