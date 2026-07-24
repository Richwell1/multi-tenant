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
import { canAccessAttendance, canAccessLeave } from '@/lib/tenant';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { company } = useSession();

  const nav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> },
    { to: '/employees', label: 'Employees', icon: <Users className="size-4" /> },
    { to: '/departments', label: 'Departments', icon: <Building className="size-4" /> },
    { to: '/positions', label: 'Positions', icon: <Briefcase className="size-4" /> },
    { to: '/updates', label: 'Available Updates', icon: <RefreshCw className="size-4" /> },
    { to: '/packages', label: 'Installed Packages', icon: <Package className="size-4" /> },
    { to: '/users', label: 'Users & Roles', icon: <UserCog className="size-4" /> },
    { to: '/settings', label: 'Settings', icon: <Settings className="size-4" /> },
  ];

  // Package-gated nav — Leave is Alpha-only; Beta must never see it.
  if (canAccessLeave(company)) {
    nav.splice(4, 0, { to: '/leave', label: 'Leave Management', icon: <CalendarClock className="size-4" /> });
  }
  if (canAccessAttendance(company)) {
    nav.splice(canAccessLeave(company) ? 5 : 4, 0, {
      to: '/attendance',
      label: 'Attendance',
      icon: <Clock className="size-4" />,
    });
  }

  return (
    <AppShell
      portal="company"
      brandLine={company?.name ?? 'Company Workspace'}
      portalBadge="Active Workspace"
      nav={nav}
    >
      {children}
    </AppShell>
  );
}
