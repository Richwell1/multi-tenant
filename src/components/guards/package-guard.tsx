import type { ReactNode } from 'react';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { hasPackage } from '@/lib/entitlements';
import { hasFeature } from '@/lib/packages/manifest';
import { PackageUnavailableState, PageLoadingState } from '@/components/states';
import type { PackageKey } from '@/data/types';

interface PackageGuardProps {
  /** The package the wrapped route requires (Open/Closed: any package). */
  packageCode: PackageKey;
  packageName: string;
  /**
   * Optional minimum installed version. When set, the route also requires the
   * company's installed version to be >= this (feature-in-version gating).
   */
  minVersion?: string;
  children: ReactNode;
}

/**
 * Route-level entitlement guard. Renders the package-unavailable state when the
 * current company is not entitled to `packageCode` (or, with `minVersion`, has
 * an older installed version). UX only — Supabase RLS on the package's tables is
 * the authoritative boundary.
 */
export function PackageGuard({ packageCode, packageName, minVersion, children }: PackageGuardProps) {
  const { codes, packages, isPending } = usePackageEntitlements();
  if (isPending) return <PageLoadingState label="Checking access…" />;
  const allowed = minVersion
    ? hasFeature(packages, packageCode, minVersion)
    : hasPackage(codes, packageCode);
  if (!allowed) {
    const label = minVersion ? `${packageName} ${minVersion}` : packageName;
    return <PackageUnavailableState packageName={label} />;
  }
  return <>{children}</>;
}
