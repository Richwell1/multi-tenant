import { describe, it, expect } from 'vitest';
import { resolveContext, getCompany } from './tenant';

describe('context resolution', () => {
  it('resolves admin from admin subdomain', () => {
    expect(resolveContext('admin.multi-tenants-hr.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves alpha from subdomain', () => {
    expect(resolveContext('alpha.multi-tenants-hr.com')).toEqual({ portal: 'company', tenantId: 'alpha' });
  });
  it('resolves beta from subdomain', () => {
    expect(resolveContext('beta.multi-tenants-hr.com')).toEqual({ portal: 'company', tenantId: 'beta' });
  });
  it('supports local dev ?portal=admin', () => {
    expect(resolveContext('localhost', '?portal=admin')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('supports local dev ?tenant=alpha', () => {
    expect(resolveContext('localhost', '?tenant=alpha')).toEqual({ portal: 'company', tenantId: 'alpha' });
  });
  it('supports local dev ?tenant=beta', () => {
    expect(resolveContext('localhost', '?tenant=beta')).toEqual({ portal: 'company', tenantId: 'beta' });
  });

  it('supports production-created tenant slugs', () => {
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
