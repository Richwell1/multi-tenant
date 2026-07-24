// ---------------------------------------------------------------------------
// Shared company-targeting domain: the single source of truth for "which
// companies does this action / filter apply to?" used platform-wide (package
// releases, assignments, and every company filter). Pure + framework-free so
// the helpers and schema are trivially unit-testable and reusable.
// ---------------------------------------------------------------------------

import { z } from 'zod';

export type CompanyTargetMode = 'all_companies' | 'selected_companies' | 'one_company';

export interface CompanyTargetValue {
  mode: CompanyTargetMode;
  companyIds: string[];
}

export const ALL_TARGET_MODES: CompanyTargetMode[] = [
  'all_companies',
  'selected_companies',
  'one_company',
];

export const TARGET_MODE_LABEL: Record<CompanyTargetMode, string> = {
  all_companies: 'All companies',
  selected_companies: 'Selected companies',
  one_company: 'One company',
};

// --- Pure helpers -------------------------------------------------------------

/** Dedupe + sort so logically identical selections produce identical keys. */
export function normalizeCompanyIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

/**
 * Normalize a target when the mode changes so stale, mode-incompatible
 * selections never linger hidden in form state.
 */
export function normalizeCompanyTarget(
  current: CompanyTargetValue,
  nextMode: CompanyTargetMode,
): CompanyTargetValue {
  switch (nextMode) {
    case 'all_companies':
      return { mode: 'all_companies', companyIds: [] };
    case 'one_company':
      // Keep the current pick only when it is unambiguous (exactly one).
      return {
        mode: 'one_company',
        companyIds: current.companyIds.length === 1 ? [...current.companyIds] : [],
      };
    case 'selected_companies':
      return { mode: 'selected_companies', companyIds: normalizeCompanyIds(current.companyIds) };
  }
}

/** Convert UI value → the payload services/repositories consume. */
export function toCompanyTargetPayload(value: CompanyTargetValue): {
  target: CompanyTargetMode;
  targetCompanyIds: string[];
} {
  return {
    target: value.mode,
    targetCompanyIds: value.mode === 'all_companies' ? [] : normalizeCompanyIds(value.companyIds),
  };
}

/** Stable query-key fragment for selections that affect fetched results. */
export function companyTargetKeyPart(value: CompanyTargetValue): {
  targetMode: CompanyTargetMode;
  companyIds: string[];
} {
  return {
    targetMode: value.mode,
    companyIds: value.mode === 'all_companies' ? [] : normalizeCompanyIds(value.companyIds),
  };
}

export const emptyCompanyTarget = (mode: CompanyTargetMode = 'all_companies'): CompanyTargetValue => ({
  mode,
  companyIds: [],
});

/** Whether a given company falls within a target selection. */
export function companyMatchesTarget(companyId: string, value: CompanyTargetValue): boolean {
  if (value.mode === 'all_companies') return true;
  return value.companyIds.includes(companyId);
}

// --- Validation ---------------------------------------------------------------

export interface CompanyTargetSchemaOptions {
  allowedModes?: CompanyTargetMode[];
  minimumSelectedCompanies?: number;
}

/**
 * Factory for a mode-restricted target schema. `all_companies` must carry no
 * ids; `one_company` exactly one; `selected_companies` at least
 * `minimumSelectedCompanies` (default 2).
 */
export function createCompanyTargetSchema(options: CompanyTargetSchemaOptions = {}) {
  const allowedModes = options.allowedModes ?? ALL_TARGET_MODES;
  const minSelected = options.minimumSelectedCompanies ?? 2;

  return z
    .object({
      mode: z.enum(allowedModes as [CompanyTargetMode, ...CompanyTargetMode[]]),
      companyIds: z.array(z.string()).default([]),
    })
    .superRefine((value, ctx) => {
      const uniqueCount = new Set(value.companyIds).size;
      if (uniqueCount !== value.companyIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['companyIds'],
          message: 'Duplicate companies are not allowed.',
        });
      }
      if (value.mode === 'all_companies' && value.companyIds.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['companyIds'],
          message: 'All companies must not contain specific company IDs.',
        });
      }
      if (value.mode === 'one_company' && value.companyIds.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['companyIds'],
          message: 'Select exactly one company.',
        });
      }
      if (value.mode === 'selected_companies' && uniqueCount < minSelected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['companyIds'],
          message: `Select at least ${minSelected} companies.`,
        });
      }
    });
}

/** Default schema (all three modes, min 2 for selected). */
export const companyTargetSchema = createCompanyTargetSchema();
