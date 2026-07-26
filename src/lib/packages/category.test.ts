import { describe, it, expect } from 'vitest';
import {
  packageCategoryLabel,
  packageVisibilityLabel,
  packageInstallerLabel,
  toPackageCategory,
  PACKAGE_CATEGORIES,
} from './category';

describe('package category labels', () => {
  it('maps each category to a human-readable label (never a raw enum)', () => {
    expect(packageCategoryLabel('standard_package')).toBe('System Package');
    expect(packageCategoryLabel('marketplace_extension')).toBe('Marketplace Extension');
    expect(packageCategoryLabel('private_extension')).toBe('Private Extension');
    expect(packageCategoryLabel('private_standalone')).toBe('Private Standalone Package');
    // No label leaks a raw enum value.
    for (const c of PACKAGE_CATEGORIES) {
      expect(packageCategoryLabel(c)).not.toMatch(/_/);
    }
  });

  it('derives visibility from category', () => {
    expect(packageVisibilityLabel('standard_package')).toBe('Platform managed');
    expect(packageVisibilityLabel('marketplace_extension')).toBe('Marketplace');
    expect(packageVisibilityLabel('private_extension')).toBe('Private');
    expect(packageVisibilityLabel('private_standalone')).toBe('Private');
  });

  it('describes who installs each category', () => {
    expect(packageInstallerLabel('standard_package')).toMatch(/Platform Admin pushes/i);
    expect(packageInstallerLabel('marketplace_extension')).toMatch(/Company Admin installs/i);
    expect(packageInstallerLabel('private_extension')).toMatch(/one company/i);
    expect(packageInstallerLabel('private_standalone')).toMatch(/one company/i);
  });
});

describe('toPackageCategory', () => {
  it('prefers the explicit persisted category', () => {
    expect(toPackageCategory({ category: 'marketplace_extension', type: 'standard_update' })).toBe('marketplace_extension');
    expect(toPackageCategory({ category: 'standard_package', type: 'standard_update' })).toBe('standard_package');
  });
  it('falls back to the legacy type when category is absent (never the name)', () => {
    expect(toPackageCategory({ type: 'private_extension' })).toBe('private_extension');
    expect(toPackageCategory({ type: 'private_customization' })).toBe('private_standalone');
    expect(toPackageCategory({ type: 'standard_update' })).toBe('standard_package');
    expect(toPackageCategory({})).toBe('standard_package');
  });
});
