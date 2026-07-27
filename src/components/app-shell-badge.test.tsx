import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useRouterState: () => '/dashboard',
}));
vi.mock('@/lib/session', () => ({ useSession: () => ({ logout: logoutMock, email: 'admin@x.com' }) }));

import { AppShell, type NavItem } from './app-shell';

const nav = (badgeCount?: number): NavItem[] => [
  { to: '/updates', label: 'Available Updates', icon: <span>i</span>, badgeCount },
];

const groupedNav: NavItem[] = [
  { to: '/a', label: 'Dashboard', icon: <span>i</span>, section: 'Platform' },
  { to: '/b', label: 'Companies', icon: <span>i</span>, section: 'Platform' },
  { to: '/c', label: 'Usage Analytics', icon: <span>i</span>, section: 'Operations' },
];

function renderShell(badgeCount?: number) {
  return render(
    <AppShell portal="company" brandLine="Test Co" portalBadge="Workspace" nav={nav(badgeCount)}>
      <div>content</div>
    </AppShell>,
  );
}

describe('sidebar update badge', () => {
  it('shows the count and a reduced-motion-aware pulse when there are pending updates', () => {
    renderShell(3);
    const badge = screen.getByLabelText('3 pending');
    expect(badge).toHaveTextContent('3');
    // Pulse uses the motion-safe variant so reduced-motion disables it via CSS.
    const dot = badge.querySelector('span[aria-hidden]');
    expect(dot?.className).toContain('motion-safe:animate-pulse');
    expect(dot?.className).not.toMatch(/(^|\s)animate-pulse(\s|$)/);
  });

  it('hides the badge (and pulse) when the count is zero', () => {
    renderShell(0);
    expect(screen.queryByLabelText(/pending/)).toBeNull();
  });

  it('shows 9+ when the count exceeds nine', () => {
    renderShell(15);
    expect(screen.getByLabelText('15 pending')).toHaveTextContent('9+');
  });
});

describe('sidebar section grouping', () => {
  it('renders section labels for grouped nav items', () => {
    render(
      <AppShell portal="admin" brandLine="Admin" portalBadge="Admin Console" nav={groupedNav}>
        <div>content</div>
      </AppShell>,
    );
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });
});

describe('top-bar profile menu', () => {
  it('opens an accessible menu with identity, role, and logout', async () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu');
    expect(menu).toHaveTextContent('admin@x.com');
    expect(menu).toHaveTextContent('Workspace'); // role/context label (portalBadge)
    fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    // Logout shows a pending state (prevents duplicate clicks).
    expect(await screen.findByRole('menuitem', { name: /signing out/i })).toBeDisabled();
  });

  it('closes on Escape', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
