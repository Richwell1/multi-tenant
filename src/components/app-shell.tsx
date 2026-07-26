import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AppVersion } from '@/components/app-version';
import { useSession } from '@/lib/session';
import { isNavItemActive } from './app-shell-nav';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Optional pending count shown as a pulsing badge (e.g. Available Updates). */
  badgeCount?: number;
  /** Optional section label; consecutive items with the same section are grouped. */
  section?: string;
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
          {nav.map((item, index) => {
            const active = isNavItemActive(pathname, item.to);
            const showSection =
              !!item.section && item.section !== nav[index - 1]?.section && (!collapsed || mobileOpen);
            return (
              <div key={item.to}>
                {showSection && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-content-variant/70">
                    {item.section}
                  </p>
                )}
              <Link
                to={item.to}
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
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
                {item.badgeCount ? (
                  <span
                    className={cn('flex items-center gap-1.5', collapsed && !mobileOpen ? 'absolute right-1 top-1' : 'ml-auto')}
                    aria-label={`${item.badgeCount} pending`}
                  >
                    {/* Subtle pulse only while there are pending items; respects reduced-motion. */}
                    <span className="size-1.5 rounded-full bg-[var(--portal-color)] motion-safe:animate-pulse" aria-hidden />
                    <span className="rounded-full bg-[var(--portal-color)]/15 px-1.5 text-xs font-medium leading-5 text-[var(--portal-color)]">
                      {item.badgeCount > 9 ? '9+' : item.badgeCount}
                    </span>
                  </span>
                ) : null}
              </Link>
              </div>
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
          <ProfileMenu email={email} roleLabel={portalBadge} onLogout={logout} />
        </header>
        <main className="mx-auto w-full max-w-container flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

/** Accessible top-bar account menu: identity, role, version, and logout. */
function ProfileMenu({ email, roleLabel, onLogout }: { email?: string | null; roleLabel: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (email?.[0] ?? 'A').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-content-variant hover:bg-surface-subtle hover:text-content"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--portal-color)]/10 text-xs font-semibold text-[var(--portal-color)]">
          {initial}
        </span>
        <span className="hidden max-w-[180px] truncate text-content sm:inline">{email ?? 'Account'}</span>
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-border bg-surface p-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-content">{email ?? 'Account'}</p>
            <p className="text-xs text-content-variant">{roleLabel}</p>
            <AppVersion className="mt-1 text-[11px] text-content-variant" />
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-content-variant hover:bg-surface-subtle hover:text-content"
          >
            <LogOut className="size-4" aria-hidden /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
