import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
import { APP_VERSION } from '@/lib/app-version';

vi.mock('@/lib/session', () => ({
  useSession: () => ({ logout: vi.fn(), email: 'admin@example.test' }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  useRouterState: () => '/admin',
}));

describe('AppShell version display', () => {
  it.each(['admin', 'company'] as const)('shows the shared version in the %s shell', (portal) => {
    render(
      <AppShell portal={portal} brandLine="Example" portalBadge="Portal" nav={[]}>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getAllByLabelText(`Application version ${APP_VERSION}`)).not.toHaveLength(0);
    expect(screen.getAllByText(APP_VERSION)).not.toHaveLength(0);
  });
});
