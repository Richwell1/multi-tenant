import { describe, it, expect } from 'vitest';
import packageJson from '../../../package.json';
import { availableFeatures, hasFeature, installedVersion } from './manifest';
import { PACKAGE_CODES } from '@/lib/entitlements';
import { APP_VERSION } from '@/lib/app-version';
import type { EnabledPackage } from '@/data/context/types';

const hrCore = (version: string): EnabledPackage[] => [{ code: 'hr-core', version }];

describe('package feature manifest (version gating)', () => {
  it('HR Core 1.0.0 exposes Departments only', () => {
    const labels = availableFeatures(hrCore('1.0.0'), 'hr-core').map((f) => f.label);
    expect(labels).toEqual(['Departments']);
  });

  it('HR Core 1.1.0 exposes Departments and Employees', () => {
    const labels = availableFeatures(hrCore('1.1.0'), 'hr-core').map((f) => f.label);
    expect(labels).toEqual(['Departments', 'Employees']);
  });

  it('Employees is hidden before HR Core 1.1.0 and shown at/after it', () => {
    expect(hasFeature(hrCore('1.0.0'), 'hr-core', '1.1.0')).toBe(false);
    expect(hasFeature(hrCore('1.1.0'), 'hr-core', '1.1.0')).toBe(true);
    expect(hasFeature(hrCore('1.2.0'), 'hr-core', '1.1.0')).toBe(true);
  });

  it('Attendance 1.0.0 exposes the Attendance feature; absent when not entitled', () => {
    const withAttendance: EnabledPackage[] = [{ code: 'attendance-management', version: '1.0.0' }];
    expect(availableFeatures(withAttendance, 'attendance-management').map((f) => f.label)).toEqual(['Attendance']);
    expect(hasFeature([], 'attendance-management', '1.0.0')).toBe(false);
  });

  it('installedVersion reflects the entitlement or null', () => {
    expect(installedVersion(hrCore('1.1.0'), 'hr-core')).toBe('1.1.0');
    expect(installedVersion([], 'hr-core')).toBeNull();
  });

  it('package versions are independent of the platform APP_VERSION', () => {
    // The demo package versions (1.0.0 / 1.1.0) must not equal the platform version.
    expect(APP_VERSION).toBe(`v${packageJson.version}`);
    expect(APP_VERSION).not.toBe('v1.1.0');
    expect(APP_VERSION).not.toBe('v1.0.0');
  });
});

describe('private-extension / standalone feature gating (entitlement-driven)', () => {
  const entitled = (code: string): EnabledPackage[] => [{ code, version: '1.0.0' }];

  it('Employee Approval card shows only when the extension is entitled', () => {
    expect(hasFeature(entitled(PACKAGE_CODES.employeeApproval), PACKAGE_CODES.employeeApproval, '1.0.0')).toBe(true);
    expect(hasFeature([], PACKAGE_CODES.employeeApproval, '1.0.0')).toBe(false);
  });

  it('Department Code field shows only when the extension is entitled', () => {
    expect(hasFeature(entitled(PACKAGE_CODES.departmentCode), PACKAGE_CODES.departmentCode, '1.0.0')).toBe(true);
    expect(hasFeature([], PACKAGE_CODES.departmentCode, '1.0.0')).toBe(false);
  });

  it('Visitor Register shows only when the standalone package is entitled', () => {
    expect(hasFeature(entitled(PACKAGE_CODES.visitorRegister), PACKAGE_CODES.visitorRegister, '1.0.0')).toBe(true);
    expect(hasFeature([], PACKAGE_CODES.visitorRegister, '1.0.0')).toBe(false);
  });
});
