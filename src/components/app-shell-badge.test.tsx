import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useRouterState: () => '/dashboard',
}));
vi.mock('@/lib/session', () => ({ useSession: () => ({ logout: vi.fn(), email: 'user@x.com' }) }));

import { AppShell, type NavItem } from './app-shell';

const nav = (badgeCount?: number): NavItem[] => [
  { to: '/updates', label: 'Available Updates', icon: <span>i</span>, badgeCount },
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
