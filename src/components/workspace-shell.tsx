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
  Store,
  FileText,
  Receipt,
  DoorOpen,
} from 'lucide-react';
import { AppShell, type NavItem } from './app-shell';
import { useSession } from '@/lib/session';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { useCompanyContext } from '@/hooks/context';
import { hasPackage, PACKAGE_CODES } from '@/lib/entitlements';
import { hasFeature } from '@/lib/packages/manifest';
import { useAvailableUpdateCount } from '@/hooks/company-updates';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { company } = useSession();
  const companyContext = useCompanyContext();
  const { codes, packages } = usePackageEntitlements();
  const updateCount = useAvailableUpdateCount();
  const companyName = company?.name ?? companyContext.data?.companyName ?? 'Company Workspace';

  // Version-gated nav — driven by installed package versions (single source):
  //   Departments/Positions ← HR Core; Employees ← HR Core >= 1.1.0;
  //   Attendance ← Attendance >= 1.0.0; Leave ← Leave entitlement.
  const hasHrCore = hasPackage(codes, PACKAGE_CODES.hrCore);
  const hasEmployees = hasFeature(packages, PACKAGE_CODES.hrCore, '1.1.0');
  const hasAttendance = hasFeature(packages, PACKAGE_CODES.attendance, '1.0.0');
  const hasLeave = hasPackage(codes, PACKAGE_CODES.leave);
  const hasDocumentNotes = hasFeature(packages, PACKAGE_CODES.documentNotes, '1.0.0');
  const hasExpenseRequests = hasFeature(packages, PACKAGE_CODES.expenseRequests, '1.0.0');
  const hasVisitorRegister = hasFeature(packages, PACKAGE_CODES.visitorRegister, '1.0.0');

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" />, section: 'Workspace' },
  ];
  if (hasHrCore) nav.push({ to: '/departments', label: 'Departments', icon: <Building className="size-4" />, section: 'Workspace' });
  if (hasEmployees) nav.push({ to: '/employees', label: 'Employees', icon: <Users className="size-4" />, section: 'Workspace' });
  if (hasHrCore) nav.push({ to: '/positions', label: 'Positions', icon: <Briefcase className="size-4" />, section: 'Workspace' });
  // Installed features (version-gated) appear only when entitled.
  if (hasLeave) nav.push({ to: '/leave', label: 'Leave Management', icon: <CalendarClock className="size-4" />, section: 'Installed Features' });
  if (hasAttendance) nav.push({ to: '/attendance', label: 'Attendance', icon: <Clock className="size-4" />, section: 'Installed Features' });
  if (hasDocumentNotes) nav.push({ to: '/extensions/document-notes', label: 'Document Notes', icon: <FileText className="size-4" />, section: 'Installed Features' });
  if (hasExpenseRequests) nav.push({ to: '/extensions/expense-requests', label: 'Expense Requests', icon: <Receipt className="size-4" />, section: 'Installed Features' });
  if (hasVisitorRegister) nav.push({ to: '/extensions/visitor-register', label: 'Visitor Register', icon: <DoorOpen className="size-4" />, section: 'Installed Features' });
  nav.push(
    { to: '/extensions/marketplace', label: 'Marketplace', icon: <Store className="size-4" />, section: 'Extensions' },
    { to: '/updates', label: 'Available Updates', icon: <RefreshCw className="size-4" />, badgeCount: updateCount, section: 'Extensions' },
    { to: '/packages', label: 'Installed Packages', icon: <Package className="size-4" />, section: 'Extensions' },
    { to: '/users', label: 'Users & Roles', icon: <UserCog className="size-4" />, section: 'Administration' },
    { to: '/settings', label: 'Settings', icon: <Settings className="size-4" />, section: 'Administration' },
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
