// ---------------------------------------------------------------------------
// Package entitlements (UX layer). The authoritative source is the resolved
// company session context, whose `enabledPackageCodes` already reflects
// company_packages.enabled AND packages.is_active. RLS on package-owned tables
// remains the real security boundary — these helpers only drive navigation and
// route gating.
// ---------------------------------------------------------------------------

import type { PackageKey } from '@/data/types';

/** Canonical package codes — avoids magic strings across the app. */
export const PACKAGE_CODES = {
  hrCore: 'hr-core',
  leave: 'leave-management',
  attendance: 'attendance-management',
  documentNotes: 'document-notes',
  expenseRequests: 'expense-requests',
  companyAnnouncements: 'company-announcements',
  assetRegister: 'asset-register',
  pulseSurveys: 'pulse-surveys',
  orgChart: 'org-chart',
  onboardingChecklist: 'custom-onboarding-checklist',
  bulkImporter: 'bulk-importer',
  employeeApproval: 'custom-employee-approval',
  departmentCode: 'custom-department-code',
  visitorRegister: 'custom-visitor-register',
} as const satisfies Record<string, PackageKey>;

/** Whether a package is entitled given a company's enabled+active codes. */
export function hasPackage(enabledCodes: readonly string[], code: PackageKey): boolean {
  return enabledCodes.includes(code);
}
