import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AppVersion } from '@/components/app-version';
import { useSession } from '@/lib/session';
import { isNavItemActive } from './app-shell-nav';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, email } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const portalClass = portal === 'admin' ? 'portal-admin' : 'portal-company';
  const accent = portal === 'admin' ? 'bg-platform' : 'bg-company';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className={cn('flex min-h-screen bg-background', portalClass)}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[min(86vw,280px)] -translate-x-full flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 md:static md:z-auto md:h-auto md:translate-x-0 md:shadow-none',
          collapsed ? 'md:w-sidebar-collapsed' : 'md:w-sidebar',
          mobileOpen && 'translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className={cn('h-8 w-1.5 shrink-0 rounded-pill', accent)} />
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-content">Multi-Tenants HR</p>
              <p className="truncate text-xs text-content-variant">{brandLine}</p>
              <AppVersion className="text-[11px] text-content-variant" />
            </div>
          )}
          <button
            type="button"
            className="ml-auto rounded-md p-2 text-content-variant hover:bg-surface-subtle hover:text-content md:hidden"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {(!collapsed || mobileOpen) && (
          <div className="px-4 py-3">
            <Badge tone={portal === 'admin' ? 'platform' : 'company'}>{portalBadge}</Badge>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {nav.map((item) => {
            const active = isNavItemActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-[var(--portal-color)]/10 font-medium text-[var(--portal-color)]'
                    : 'text-content-variant hover:bg-surface-subtle hover:text-content',
                  collapsed && 'justify-center',
                )}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <span className="shrink-0">{item.icon}</span>
                {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <div className="px-3 pb-2 text-[11px] text-content-variant">
            <AppVersion />
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-content-variant hover:bg-surface-subtle"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-content/30 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-md p-2 text-content-variant hover:bg-surface-subtle hover:text-content md:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <span className="truncate text-sm font-medium text-content-variant">{brandLine}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {email && <span className="hidden max-w-[220px] truncate text-sm text-content sm:inline">{email}</span>}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-content-variant hover:bg-surface-subtle hover:text-content"
            >
              <LogOut className="size-4" /> Logout
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-container flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
