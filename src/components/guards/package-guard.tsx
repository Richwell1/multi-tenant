import type { ReactNode } from 'react';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { hasPackage } from '@/lib/entitlements';
import { PackageUnavailableState, PageLoadingState } from '@/components/states';
import type { PackageKey } from '@/data/types';

interface PackageGuardProps {
  /** The package the wrapped route requires (Open/Closed: any package). */
  packageCode: PackageKey;
  packageName: string;
  children: ReactNode;
}

/**
 * Route-level entitlement guard. Renders the package-unavailable state when the
 * current company is not entitled to `packageCode`. UX only — Supabase RLS on
 * the package's tables is the authoritative boundary.
 */
export function PackageGuard({ packageCode, packageName, children }: PackageGuardProps) {
  const { codes, isPending } = usePackageEntitlements();
  if (isPending) return <PageLoadingState label="Checking access…" />;
  if (!hasPackage(codes, packageCode)) return <PackageUnavailableState packageName={packageName} />;
  return <>{children}</>;
}
