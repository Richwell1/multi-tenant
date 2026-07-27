// ---------------------------------------------------------------------------
// Package version impact manifests — the structured "what changes" that drives
// the install / update / rollback REVIEW dialogs. Mirrors the DB
// `package_versions.impact_manifest jsonb`; kept in TS so the runnable
// mock/demo and tests have a single source. Structured fields, not free text.
// ---------------------------------------------------------------------------

import type { DiagnosticResult } from '@/data/types';

export interface PackageImpactManifest {
  version: string;
  previousVersion?: string;
  releaseNotes?: string;
  /** A breaking or irreversible change requires explicit acknowledgement. */
  breaking?: boolean;
  frontend: {
    routesAdded?: string[];
    navigationItemsAdded?: string[];
    navigationItemsRemoved?: string[];
    formsChanged?: string[];
    componentsChanged?: string[];
  };
  backend: {
    tablesAdded?: string[];
    tablesChanged?: string[];
    rpcsAdded?: string[];
    policiesChanged?: string[];
    grantsChanged?: string[];
  };
  data: { notes?: string[] };
  dependencies: {
    minimumPlatformVersion?: string;
    basePackageKey?: string;
    minimumBasePackageVersion?: string;
    incompatiblePackageKeys?: string[];
  };
  migrations: { required: boolean; reversible: boolean; notes?: string[] };
  rollback: { supported: boolean; eligibleTargetVersions?: string[]; limitations?: string[] };
  retention: { policy: 'preserve' | 'retain_then_purge'; retentionDays: number };
  diagnostics: { status: DiagnosticResult; checks?: { label: string; status: DiagnosticResult }[] };
}

const PASS: DiagnosticResult = 'PASS';

const documentNotes: Record<string, PackageImpactManifest> = {
  '1.0.0': {
    version: '1.0.0',
    releaseNotes: 'Initial Document Notes release: company-scoped notes.',
    frontend: {
      routesAdded: ['/:companySlug/extensions/document-notes'],
      navigationItemsAdded: ['Document Notes'],
      formsChanged: ['Note creation form'],
    },
    backend: {
      tablesAdded: ['document_notes'],
      policiesChanged: ['document_notes company-scoped RLS'],
      grantsChanged: ['authenticated SELECT/INSERT/UPDATE/DELETE on document_notes'],
    },
    data: { notes: ['Creates company-owned note records', 'Uninstall retains records for 30 days'] },
    dependencies: { minimumPlatformVersion: 'v0.1.0' },
    migrations: { required: true, reversible: true },
    rollback: { supported: false, limitations: ['No prior version to roll back to'] },
    retention: { policy: 'retain_then_purge', retentionDays: 30 },
    diagnostics: {
      status: PASS,
      checks: [
        { label: 'Database table', status: PASS },
        { label: 'Authenticated grants', status: PASS },
        { label: 'RLS', status: PASS },
        { label: 'Package key consistency', status: PASS },
        { label: 'Frontend route', status: PASS },
        { label: 'Repository implementation', status: PASS },
      ],
    },
  },
  '1.1.0': {
    version: '1.1.0',
    previousVersion: '1.0.0',
    releaseNotes: 'Adds note categories and a category filter.',
    frontend: {
      navigationItemsAdded: [],
      formsChanged: ['Note creation form (category field)'],
      componentsChanged: ['Notes list (category filter)'],
    },
    backend: {
      tablesChanged: ['document_notes.category added'],
      policiesChanged: ['document_notes RLS updated'],
    },
    data: { notes: ['Adds a nullable category field', 'Existing category values are preserved on rollback'] },
    dependencies: { minimumPlatformVersion: 'v0.1.0' },
    migrations: { required: true, reversible: true },
    rollback: { supported: true, eligibleTargetVersions: ['1.0.0'], limitations: ['Category values remain stored but hidden'] },
    retention: { policy: 'retain_then_purge', retentionDays: 30 },
    diagnostics: { status: PASS, checks: [{ label: 'Migration reversibility', status: PASS }, { label: 'RLS', status: PASS }] },
  },
};

const expenseRequests: Record<string, PackageImpactManifest> = {
  '1.0.0': {
    version: '1.0.0',
    releaseNotes: 'Company expense requests.',
    frontend: { routesAdded: ['/:companySlug/extensions/expense-requests'], navigationItemsAdded: ['Expense Requests'], formsChanged: ['Expense request form'] },
    backend: { tablesAdded: ['expense_requests'], policiesChanged: ['expense_requests RLS'], grantsChanged: ['authenticated CRUD on expense_requests'] },
    data: { notes: ['Creates company-owned expense records', 'Uninstall retains records for 30 days'] },
    dependencies: { minimumPlatformVersion: 'v0.1.0' },
    migrations: { required: true, reversible: true },
    rollback: { supported: false },
    retention: { policy: 'retain_then_purge', retentionDays: 30 },
    diagnostics: { status: PASS, checks: [{ label: 'Database table', status: PASS }, { label: 'RLS', status: PASS }, { label: 'Authenticated grants', status: PASS }] },
  },
};

/** Package key → version → manifest. */
export const PACKAGE_IMPACT: Record<string, Record<string, PackageImpactManifest>> = {
  'document-notes': documentNotes,
  'expense-requests': expenseRequests,
};

/** The impact manifest for a package version, if known. */
export function impactManifest(packageKey: string, version: string): PackageImpactManifest | null {
  return PACKAGE_IMPACT[packageKey]?.[version] ?? null;
}

/** The latest known manifest for a package (highest version key present). */
export function latestImpactManifest(packageKey: string): PackageImpactManifest | null {
  const byVersion = PACKAGE_IMPACT[packageKey];
  if (!byVersion) return null;
  const versions = Object.keys(byVersion).sort();
  return byVersion[versions[versions.length - 1]!] ?? null;
}
