import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Package,
  Stethoscope,
  DownloadCloud,
  BarChart3,
  Activity,
  ScrollText,
  TrendingUp,
} from 'lucide-react';
import { AppShell, type NavItem } from './app-shell';

const nav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="size-4" />, section: 'Platform' },
  { to: '/admin/companies', label: 'Companies', icon: <Building2 className="size-4" />, section: 'Platform' },
  { to: '/admin/requests', label: 'Request Records', icon: <Inbox className="size-4" />, section: 'Platform' },
  { to: '/admin/packages', label: 'Packages', icon: <Package className="size-4" />, section: 'Packages' },
  { to: '/admin/installations', label: 'Installations', icon: <DownloadCloud className="size-4" />, section: 'Packages' },
  { to: '/admin/lifecycle', label: 'Lifecycle Monitoring', icon: <Activity className="size-4" />, section: 'Packages' },
  { to: '/admin/packages/adoption', label: 'Adoption', icon: <TrendingUp className="size-4" />, section: 'Packages' },
  { to: '/admin/usage', label: 'Usage Analytics', icon: <BarChart3 className="size-4" />, section: 'Operations' },
  { to: '/admin/health', label: 'System Health', icon: <Activity className="size-4" />, section: 'Operations' },
  { to: '/admin/audit', label: 'Audit Logs', icon: <ScrollText className="size-4" />, section: 'Operations' },
  { to: '/admin/diagnostics', label: 'Diagnostics', icon: <Stethoscope className="size-4" />, section: 'Operations' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AppShell portal="admin" brandLine="Platform Super Admin" portalBadge="Admin Console" nav={nav}>
      {children}
    </AppShell>
  );
}
