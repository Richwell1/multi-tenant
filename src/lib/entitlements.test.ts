import { describe, it, expect } from 'vitest';
import { hasPackage, PACKAGE_CODES } from './entitlements';

describe('package entitlements', () => {
  it('exposes canonical package codes', () => {
    expect(PACKAGE_CODES.hrCore).toBe('hr-core');
    expect(PACKAGE_CODES.leave).toBe('leave-management');
    expect(PACKAGE_CODES.attendance).toBe('attendance-management');
  });

  it('encodes the demo business rules over enabled codes', () => {
    const alpha = ['hr-core', 'leave-management'];
    const beta = ['hr-core'];
    // Alpha has Leave; Beta must not.
    expect(hasPackage(alpha, PACKAGE_CODES.leave)).toBe(true);
    expect(hasPackage(beta, PACKAGE_CODES.leave)).toBe(false);
    // Attendance can be enabled for any company (all-company standard update).
    expect(hasPackage(beta, PACKAGE_CODES.attendance)).toBe(false);
    expect(hasPackage([...beta, 'attendance-management'], PACKAGE_CODES.attendance)).toBe(true);
  });
});
