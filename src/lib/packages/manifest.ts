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
  [PACKAGE_CODES.companyAnnouncements]: {
    code: PACKAGE_CODES.companyAnnouncements,
    name: 'Company Announcements',
    features: [{ label: 'Announcements', minVersion: '1.0.0', route: '/extensions/announcements' }],
  },
  [PACKAGE_CODES.assetRegister]: {
    code: PACKAGE_CODES.assetRegister,
    name: 'Asset Register',
    features: [{ label: 'Assets', minVersion: '1.0.0', route: '/extensions/assets' }],
  },
  [PACKAGE_CODES.pulseSurveys]: {
    code: PACKAGE_CODES.pulseSurveys,
    name: 'Pulse Surveys',
    features: [{ label: 'Pulse Surveys', minVersion: '1.0.0', route: '/extensions/pulse-surveys' }],
  },
  [PACKAGE_CODES.orgChart]: {
    code: PACKAGE_CODES.orgChart,
    name: 'Org Chart Viewer',
    features: [{ label: 'Org Chart', minVersion: '1.0.0', route: '/extensions/org-chart' }],
  },
  [PACKAGE_CODES.bulkImporter]: {
    code: PACKAGE_CODES.bulkImporter,
    name: 'Bulk Data Importer',
    features: [{ label: 'Bulk Import', minVersion: '1.0.0', route: '/extensions/bulk-import' }],
  },
  // Private extensions render inside existing HR Core surfaces for the assigned company.
  [PACKAGE_CODES.employeeApproval]: {
    code: PACKAGE_CODES.employeeApproval,
    name: 'Custom Employee Approval Card',
    features: [{ label: 'Employee Approval', minVersion: '1.0.0', route: '/employees' }],
  },
  [PACKAGE_CODES.onboardingChecklist]: {
    code: PACKAGE_CODES.onboardingChecklist,
    name: 'Custom Onboarding Checklist',
    features: [{ label: 'Onboarding Checklist', minVersion: '1.0.0', route: '/employees' }],
  },
  [PACKAGE_CODES.departmentCode]: {
    code: PACKAGE_CODES.departmentCode,
    name: 'Custom Department Code Field',
    features: [{ label: 'Department Code', minVersion: '1.0.0', route: '/departments' }],
  },
  [PACKAGE_CODES.visitorRegister]: {
    code: PACKAGE_CODES.visitorRegister,
    name: 'Custom Visitor Register',
    features: [{ label: 'Visitor Register', minVersion: '1.0.0', route: '/extensions/visitor-register' }],
  },
};

/**
 * Presentation-only marketplace categories (grouping in the Extensions
 * Marketplace). Not a business rule — maps package keys to a browse category.
 */
export const MARKETPLACE_CATEGORIES = ['All', 'Productivity', 'Finance', 'HR Tools', 'Operations'] as const;
export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

const MARKETPLACE_CATEGORY_BY_CODE: Record<string, MarketplaceCategory> = {
  'document-notes': 'Productivity',
  'expense-requests': 'Finance',
  'company-announcements': 'Productivity',
  'asset-register': 'Operations',
  'pulse-surveys': 'HR Tools',
};

export function marketplaceCategory(code: string): MarketplaceCategory {
  return MARKETPLACE_CATEGORY_BY_CODE[code] ?? 'Operations';
}

/** Feature labels a marketplace package advertises (from the manifest). */
export function packageFeatureLabels(code: PackageKey): string[] {
  return (PACKAGE_MANIFEST[code]?.features ?? []).map((f) => f.label);
}

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
