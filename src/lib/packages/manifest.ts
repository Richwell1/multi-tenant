// ---------------------------------------------------------------------------
// Centralized package → feature manifest. ONE source of truth for:
//   - which features a package version exposes (dashboard display)
//   - the minimum installed version that unlocks each feature (nav + route gate)
// Package/feature versions are independent of the platform APP_VERSION
// (package.json). Never hardcode a package version anywhere else.
// ---------------------------------------------------------------------------

import type { PackageKey } from '@/data/types';
import { PACKAGE_CODES } from '@/lib/entitlements';
import { semverGte } from '@/lib/semver';
import type { EnabledPackage } from '@/data/context/types';

export interface PackageFeature {
  /** Human label shown on the dashboard. */
  label: string;
  /** Installed package version at or above which this feature is available. */
  minVersion: string;
  /** Workspace route the feature maps to (for nav/route gating). */
  route: string;
}

export interface PackageManifestEntry {
  code: PackageKey;
  name: string;
  features: PackageFeature[];
}

/**
 * Demo package model:
 *   HR Core 1.0.0 → Departments; 1.1.0 → Departments + Employees
 *   Attendance Management 1.0.0 → Attendance
 */
export const PACKAGE_MANIFEST: Partial<Record<PackageKey, PackageManifestEntry>> = {
  [PACKAGE_CODES.hrCore]: {
    code: PACKAGE_CODES.hrCore,
    name: 'HR Core',
    features: [
      { label: 'Departments', minVersion: '1.0.0', route: '/departments' },
      { label: 'Employees', minVersion: '1.1.0', route: '/employees' },
    ],
  },
  [PACKAGE_CODES.attendance]: {
    code: PACKAGE_CODES.attendance,
    name: 'Attendance Management',
    features: [{ label: 'Attendance', minVersion: '1.0.0', route: '/attendance' }],
  },
  [PACKAGE_CODES.leave]: {
    code: PACKAGE_CODES.leave,
    name: 'Leave Management',
    features: [{ label: 'Leave', minVersion: '1.0.0', route: '/leave' }],
  },
  [PACKAGE_CODES.documentNotes]: {
    code: PACKAGE_CODES.documentNotes,
    name: 'Document Notes',
    features: [
      { label: 'Document Notes', minVersion: '1.0.0', route: '/extensions/document-notes' },
      { label: 'Note categories', minVersion: '1.1.0', route: '/extensions/document-notes' },
    ],
  },
  [PACKAGE_CODES.expenseRequests]: {
    code: PACKAGE_CODES.expenseRequests,
    name: 'Expense Requests',
    features: [{ label: 'Expense Requests', minVersion: '1.0.0', route: '/extensions/expense-requests' }],
  },
  // Private extensions render inside existing HR Core surfaces for the assigned company.
  [PACKAGE_CODES.employeeApproval]: {
    code: PACKAGE_CODES.employeeApproval,
    name: 'Custom Employee Approval Card',
    features: [{ label: 'Employee Approval', minVersion: '1.0.0', route: '/employees' }],
  },
  [PACKAGE_CODES.departmentCode]: {
    code: PACKAGE_CODES.departmentCode,
    name: 'Custom Department Code Field',
    features: [{ label: 'Department Code', minVersion: '1.0.0', route: '/departments' }],
  },
};

/** Installed version of a package for the company, or null when not entitled. */
export function installedVersion(packages: readonly EnabledPackage[], code: PackageKey): string | null {
  return packages.find((p) => p.code === code)?.version ?? null;
}

/** Features unlocked for a package at the company's installed version. */
export function availableFeatures(packages: readonly EnabledPackage[], code: PackageKey): PackageFeature[] {
  const version = installedVersion(packages, code);
  if (version === null) return [];
  const entry = PACKAGE_MANIFEST[code];
  return entry ? entry.features.filter((f) => semverGte(version, f.minVersion)) : [];
}

/**
 * Whether the company can use a feature: it must have the package enabled AND
 * the installed version must meet the feature's minimum version.
 */
export function hasFeature(
  packages: readonly EnabledPackage[],
  code: PackageKey,
  minVersion: string,
): boolean {
  return semverGte(installedVersion(packages, code), minVersion);
}
