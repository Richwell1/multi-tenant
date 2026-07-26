import { useCompanyContext } from '@/hooks/context';
import { hasPackage } from '@/lib/entitlements';
import type { PackageKey } from '@/data/types';

/**
 * Package entitlements for the signed-in company, resolved from the membership
 * context (single source of truth for both mock and Supabase data sources).
 */
export function usePackageEntitlements() {
  const context = useCompanyContext();
  return {
    codes: context.data?.enabledPackageCodes ?? [],
    /** Enabled packages with installed versions (drives version-gated features). */
    packages: context.data?.enabledPackages ?? [],
    isPending: context.isPending,
    isError: context.isError,
  };
}

/** Whether the current company is entitled to a specific package. */
export function useHasPackage(code: PackageKey): boolean {
  return hasPackage(usePackageEntitlements().codes, code);
}
