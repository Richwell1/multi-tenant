// ---------------------------------------------------------------------------
// Package category presentation. Raw database enum values (standard_update,
// private_extension, private_customization, …) are NEVER shown to users — this
// is the single source that maps the distribution category to human labels,
// visibility, and who installs it.
// ---------------------------------------------------------------------------

import type { PackageType } from '@/data/types';

/** Distribution / ownership category (persisted in `packages.category`). */
export type PackageCategory =
  | 'standard_package'
  | 'marketplace_extension'
  | 'private_extension'
  | 'private_standalone';

export type PackageVisibility = 'platform' | 'marketplace' | 'private';

export const PACKAGE_CATEGORIES: PackageCategory[] = [
  'standard_package',
  'marketplace_extension',
  'private_extension',
  'private_standalone',
];

const CATEGORY_LABELS: Record<PackageCategory, string> = {
  standard_package: 'System Package',
  marketplace_extension: 'Marketplace Extension',
  private_extension: 'Private Extension',
  private_standalone: 'Private Standalone Package',
};

export function packageCategoryLabel(category: PackageCategory): string {
  return CATEGORY_LABELS[category];
}

/** Visibility is derived from category — one source of truth (no drift). */
export function packageVisibility(category: PackageCategory): PackageVisibility {
  switch (category) {
    case 'marketplace_extension':
      return 'marketplace';
    case 'private_extension':
    case 'private_standalone':
      return 'private';
    case 'standard_package':
    default:
      return 'platform';
  }
}

const VISIBILITY_LABELS: Record<PackageVisibility, string> = {
  platform: 'Platform managed',
  marketplace: 'Marketplace',
  private: 'Private',
};

export function packageVisibilityLabel(category: PackageCategory): string {
  return VISIBILITY_LABELS[packageVisibility(category)];
}

/** Who installs a package of this category (shown in details / help text). */
const INSTALLER_LABELS: Record<PackageCategory, string> = {
  standard_package: 'Platform Admin pushes to all active companies',
  marketplace_extension: 'Company Admin installs from the marketplace',
  private_extension: 'Platform Admin assigns to one company',
  private_standalone: 'Platform Admin assigns to one company',
};

export function packageInstallerLabel(category: PackageCategory): string {
  return INSTALLER_LABELS[category];
}

/**
 * Resolve the category from persisted metadata. Prefers the explicit
 * `category` column; falls back to deriving from the legacy `type` enum for
 * rows that predate it. Never infers from the package name.
 */
export function toPackageCategory(input: { category?: string | null; type?: PackageType | null }): PackageCategory {
  const c = input.category;
  if (c === 'standard_package' || c === 'marketplace_extension' || c === 'private_extension' || c === 'private_standalone') {
    return c;
  }
  switch (input.type) {
    case 'private_extension':
      return 'private_extension';
    case 'private_customization':
      return 'private_standalone';
    default:
      return 'standard_package';
  }
}
