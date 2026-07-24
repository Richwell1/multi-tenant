import { useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/session';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

interface AppShellProps {
  portal: 'admin' | 'company';
  brandLine: string;
  portalBadge: string;
  nav: NavItem[];
  children: ReactNode;
}

export function AppShell({ portal, brandLine, portalBadge, nav, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, email } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const portalClass = portal === 'admin' ? 'portal-admin' : 'portal-company';
  const accent = portal === 'admin' ? 'bg-platform' : 'bg-company';

  return (
    <div className={cn('flex min-h-screen bg-background', portalClass)}>
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-surface transition-all duration-200',
          collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className={cn('h-8 w-1.5 shrink-0 rounded-pill', accent)} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-content">Multi-Tenants HR</p>
              <p className="truncate text-xs text-content-variant">{brandLine}</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-3">
            <Badge tone={portal === 'admin' ? 'platform' : 'company'}>{portalBadge}</Badge>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[var(--portal-color)]/10 font-medium text-[var(--portal-color)]'
                    : 'text-content-variant hover:bg-surface-subtle hover:text-content',
                  collapsed && 'justify-center',
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-content-variant hover:bg-surface-subtle"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
          <span className="text-sm text-content-variant">{brandLine}</span>
          <div className="flex items-center gap-4">
            {email && <span className="text-sm text-content">{email}</span>}
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-content-variant hover:text-content"
            >
              <LogOut className="size-4" /> Logout
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-container flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
