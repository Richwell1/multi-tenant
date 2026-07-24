import { describe, it, expect } from 'vitest';
import {
  resolveContext,
  getCompany,
  canAccessLeave,
  canAccessAttendance,
  companyHasPackage,
} from './tenant';
import { companies } from '@/data/mock';

const alpha = companies.find((c) => c.id === 'alpha');
const beta = companies.find((c) => c.id === 'beta');

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
  it('defaults bare localhost to admin', () => {
    expect(resolveContext('localhost')).toEqual({ portal: 'admin', tenantId: null });
  });
});

describe('package gating — business rules', () => {
  it('Alpha has HR Core and Leave Management', () => {
    expect(companyHasPackage(alpha, 'hr-core')).toBe(true);
    expect(canAccessLeave(alpha)).toBe(true);
  });
  it('Beta has HR Core only and cannot access Leave', () => {
    expect(companyHasPackage(beta, 'hr-core')).toBe(true);
    expect(canAccessLeave(beta)).toBe(false);
  });
  it('Attendance can be enabled for any company', () => {
    // Not enabled by default for either tenant...
    expect(canAccessAttendance(alpha)).toBe(false);
    expect(canAccessAttendance(beta)).toBe(false);
    // ...but enabling it (all-company standard update) grants access to both.
    const alphaWithAttendance = { ...alpha!, packages: [...alpha!.packages, 'attendance-management' as const] };
    const betaWithAttendance = { ...beta!, packages: [...beta!.packages, 'attendance-management' as const] };
    expect(canAccessAttendance(alphaWithAttendance)).toBe(true);
    expect(canAccessAttendance(betaWithAttendance)).toBe(true);
  });
  it('getCompany returns undefined for admin (null tenant)', () => {
    expect(getCompany(null)).toBeUndefined();
  });
});
