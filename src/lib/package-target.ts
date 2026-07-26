// ---------------------------------------------------------------------------
// Business rules mapping a package/extension classification to the company
// target modes it is allowed to use. Pure + centralized so both the package
// release form and the request-linking form share one source of truth.
// ---------------------------------------------------------------------------

import type { PackageType } from '@/data/types';
import type { CompanyTargetMode } from './company-target';

export function allowedTargetModesForPackageType(type: PackageType): CompanyTargetMode[] {
  switch (type) {
    case 'private_customization':
    case 'private_extension':
      // A private customization or private extension only ever targets one company.
      return ['one_company'];
    case 'shared_extension':
      // A shared extension targets a group or everyone — never exactly one.
      return ['selected_companies', 'all_companies'];
    case 'standard_update':
    case 'bug_fix':
    default:
      return ['all_companies', 'selected_companies', 'one_company'];
  }
}

/** Request linking uses the same rules, keyed by extension nature. */
export type ExtensionNature = 'private_extension' | 'shared_extension';

export function allowedTargetModesForExtension(nature: ExtensionNature): CompanyTargetMode[] {
  return nature === 'private_extension'
    ? ['one_company']
    : ['selected_companies', 'all_companies'];
}
