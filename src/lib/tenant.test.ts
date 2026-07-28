import { describe, it, expect } from 'vitest';
import {
  resolveContext,
  getCompany,
  isTenantHost,
  isAppHost,
  workspacePath,
  resolveWorkspaceDestination,
} from './tenant';

const BASE = 'merbsconnect.com';

describe('context resolution', () => {
  it('resolves admin/marketing from the home subdomain', () => {
    expect(resolveContext('home.merbsconnect.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves admin from the legacy admin subdomain', () => {
    expect(resolveContext('admin.merbsconnect.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves admin from www', () => {
    expect(resolveContext('www.merbsconnect.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves admin from the bare app domain (apex is not routed to this app)', () => {
    expect(resolveContext('merbsconnect.com')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('resolves a company tenant from any other real subdomain (wildcard)', () => {
    expect(resolveContext('acme.merbsconnect.com')).toEqual({ portal: 'company', tenantId: 'acme' });
    expect(resolveContext('other-co.merbsconnect.com')).toEqual({ portal: 'company', tenantId: 'other-co' });
  });
  it('supports local dev ?portal=admin', () => {
    expect(resolveContext('localhost', '?portal=admin')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('supports the dev ?tenant= override even on a real tenant subdomain', () => {
    expect(resolveContext('acme.merbsconnect.com', '?tenant=other-co')).toEqual({
      portal: 'company',
      tenantId: 'other-co',
    });
  });
  it('resolves any dynamically-created tenant slug via ?tenant= on non-app hosts', () => {
    expect(resolveContext('localhost', '?tenant=acme')).toEqual({ portal: 'company', tenantId: 'acme' });
    expect(resolveContext('localhost', '?tenant=other-co')).toEqual({ portal: 'company', tenantId: 'other-co' });
  });
  it('defaults bare localhost to admin', () => {
    expect(resolveContext('localhost')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('defaults an unrelated preview/deployment host to admin', () => {
    expect(resolveContext('multi-tenants-hr.pages.dev')).toEqual({ portal: 'admin', tenantId: null });
  });
  it('getCompany returns undefined for admin (null tenant)', () => {
    expect(getCompany(null)).toBeUndefined();
  });
});

describe('isTenantHost', () => {
  it('is true for a normal company subdomain', () => {
    expect(isTenantHost('acme.merbsconnect.com', BASE)).toBe(true);
  });
  it('is false for the reserved home/www/admin subdomains', () => {
    expect(isTenantHost('home.merbsconnect.com', BASE)).toBe(false);
    expect(isTenantHost('www.merbsconnect.com', BASE)).toBe(false);
    expect(isTenantHost('admin.merbsconnect.com', BASE)).toBe(false);
  });
  it('is false for the bare app domain', () => {
    expect(isTenantHost('merbsconnect.com', BASE)).toBe(false);
  });
  it('is false for a multi-label subdomain', () => {
    expect(isTenantHost('foo.acme.merbsconnect.com', BASE)).toBe(false);
  });
  it('is false for unrelated hosts', () => {
    expect(isTenantHost('localhost', BASE)).toBe(false);
    expect(isTenantHost('acme.other-domain.com', BASE)).toBe(false);
  });
});

describe('isAppHost', () => {
  it('is true for the bare app domain and every subdomain', () => {
    expect(isAppHost('merbsconnect.com', BASE)).toBe(true);
    expect(isAppHost('home.merbsconnect.com', BASE)).toBe(true);
    expect(isAppHost('acme.merbsconnect.com', BASE)).toBe(true);
  });
  it('is false for unrelated hosts', () => {
    expect(isAppHost('localhost', BASE)).toBe(false);
    expect(isAppHost('merbsconnect.com.evil.com', BASE)).toBe(false);
  });
});

describe('workspacePath', () => {
  it('returns a bare path on a real tenant subdomain', () => {
    expect(workspacePath('acme', '/dashboard', 'acme.merbsconnect.com')).toBe('/dashboard');
  });
  it('prefixes the slug everywhere else', () => {
    expect(workspacePath('acme', '/dashboard', 'localhost')).toBe('/acme/dashboard');
    expect(workspacePath('acme', '/dashboard', 'home.merbsconnect.com')).toBe('/acme/dashboard');
  });
});

describe('resolveWorkspaceDestination', () => {
  it('stays same-origin (bare path) when already on the tenant subdomain', () => {
    expect(resolveWorkspaceDestination('acme', '/dashboard', 'acme.merbsconnect.com')).toBe('/dashboard');
  });
  it('stays same-origin (slug-prefixed path) on a non-app host, e.g. local dev', () => {
    expect(resolveWorkspaceDestination('acme', '/dashboard', 'localhost')).toBe('/acme/dashboard');
  });
  it('crosses origin from the marketing/admin host to the tenant subdomain', () => {
    expect(resolveWorkspaceDestination('acme', '/dashboard', 'home.merbsconnect.com')).toBe(
      'https://acme.merbsconnect.com/dashboard',
    );
  });
});
