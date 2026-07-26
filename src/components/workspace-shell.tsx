import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Building,
  Briefcase,
  RefreshCw,
  Package,
  UserCog,
  Settings,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { AppShell, type NavItem } from './app-shell';
import { useSession } from '@/lib/session';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { useCompanyContext } from '@/hooks/context';
import { hasPackage, PACKAGE_CODES } from '@/lib/entitlements';
import { hasFeature } from '@/lib/packages/manifest';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { company } = useSession();
  const companyContext = useCompanyContext();
  const { codes, packages } = usePackageEntitlements();
  const companyName = company?.name ?? companyContext.data?.companyName ?? 'Company Workspace';

  // Version-gated nav — driven by installed package versions (single source):
  //   Departments/Positions ← HR Core; Employees ← HR Core >= 1.1.0;
  //   Attendance ← Attendance >= 1.0.0; Leave ← Leave entitlement.
  const hasHrCore = hasPackage(codes, PACKAGE_CODES.hrCore);
  const hasEmployees = hasFeature(packages, PACKAGE_CODES.hrCore, '1.1.0');
  const hasAttendance = hasFeature(packages, PACKAGE_CODES.attendance, '1.0.0');
  const hasLeave = hasPackage(codes, PACKAGE_CODES.leave);

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> },
  ];
  if (hasHrCore) nav.push({ to: '/departments', label: 'Departments', icon: <Building className="size-4" /> });
  if (hasEmployees) nav.push({ to: '/employees', label: 'Employees', icon: <Users className="size-4" /> });
  if (hasHrCore) nav.push({ to: '/positions', label: 'Positions', icon: <Briefcase className="size-4" /> });
  if (hasLeave) nav.push({ to: '/leave', label: 'Leave Management', icon: <CalendarClock className="size-4" /> });
  if (hasAttendance) nav.push({ to: '/attendance', label: 'Attendance', icon: <Clock className="size-4" /> });
  nav.push(
    { to: '/updates', label: 'Available Updates', icon: <RefreshCw className="size-4" /> },
    { to: '/packages', label: 'Installed Packages', icon: <Package className="size-4" /> },
    { to: '/users', label: 'Users & Roles', icon: <UserCog className="size-4" /> },
    { to: '/settings', label: 'Settings', icon: <Settings className="size-4" /> },
  );

  return (
    <AppShell
      portal="company"
      brandLine={companyName}
      portalBadge="Active Workspace"
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
