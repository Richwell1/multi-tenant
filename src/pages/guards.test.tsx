import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';
import { SessionProvider, useSession } from '@/lib/session';
import { authRepository } from '@/data/auth';
import { routeTree } from '@/router';

/**
 * Integration tests for the live route guards. Auth is driven through the real
 * mock auth singleton; the SessionProvider resolves portal/tenant from the URL
 * (set via replaceState); the memory router starts at the guarded path.
 */
async function renderGuarded(opts: { path: string; url: string; email?: string }) {
  window.history.replaceState({}, '', opts.url);
  if (opts.email) await authRepository.signIn({ email: opts.email, password: 'x' });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [opts.path] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return router;
}

const at = (router: { state: { location: { pathname: string } } }) => router.state.location.pathname;

describe('route guards', () => {
  beforeEach(async () => {
    await authRepository.signOut();
    window.history.replaceState({}, '', '/');
  });

  it('unauthenticated /admin → /login', async () => {
    const router = await renderGuarded({ path: '/admin', url: '/login?portal=admin' });
    await waitFor(() => expect(at(router)).toBe('/login'), { timeout: 5000 });
  });

  it('company user cannot access /admin → /access-denied', async () => {
    const router = await renderGuarded({ path: '/admin', url: '/login?portal=admin', email: 'company-user@x.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'), { timeout: 5000 });
  });

  it('active platform admin can access /admin', async () => {
    const router = await renderGuarded({ path: '/admin', url: '/login?portal=admin', email: 'super@platform.test' });
    await waitFor(() => expect(at(router)).toBe('/admin'), { timeout: 5000 });
  });

  it('Alpha member can access Alpha workspace', async () => {
    const router = await renderGuarded({ path: '/alpha/dashboard', url: '/login?tenant=alpha', email: 'admin@alpha.test' });
    await waitFor(() => expect(at(router)).toBe('/alpha/dashboard'), { timeout: 5000 });
  });

  it('bare /:companySlug redirects to the slugged dashboard', async () => {
    const router = await renderGuarded({ path: '/alpha', url: '/login?tenant=alpha', email: 'admin@alpha.test' });
    await waitFor(() => expect(at(router)).toBe('/alpha/dashboard'), { timeout: 5000 });
  });

  it('shared login allows a company member on their own slug', async () => {
    const router = await renderGuarded({ path: '/beta/dashboard', url: '/login', email: 'admin@beta.test' });
    await waitFor(() => expect(at(router)).toBe('/beta/dashboard'), { timeout: 5000 });
  });

  it('Alpha slug + Beta member → /access-denied (tenant mismatch)', async () => {
    const router = await renderGuarded({ path: '/alpha/dashboard', url: '/login', email: 'admin@beta.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'), { timeout: 5000 });
  });

  it('suspended company → /company-suspended', async () => {
    const router = await renderGuarded({ path: '/gamma/dashboard', url: '/login?tenant=gamma', email: 'admin@gamma.test' });
    await waitFor(() => expect(at(router)).toBe('/company-suspended'), { timeout: 5000 });
  });

  it('inactive membership → /access-denied', async () => {
    const router = await renderGuarded({ path: '/alpha/dashboard', url: '/login?tenant=alpha', email: 'inactive@alpha.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'), { timeout: 5000 });
  });
});

describe('logout clears tenant-scoped cache', () => {
  beforeEach(async () => {
    await authRepository.signOut();
    window.history.replaceState({}, '', '/login?tenant=alpha');
  });

  it('queryClient is cleared on logout', async () => {
    await authRepository.signIn({ email: 'admin@alpha.test', password: 'x' });
    const qc = new QueryClient();
    qc.setQueryData(['employees', 'alpha'], [{ id: 'secret' }]);

    function LogoutButton() {
      const { logout } = useSession();
      return <button onClick={() => void logout()}>logout</button>;
    }
    render(
      <QueryClientProvider client={qc}>
        <SessionProvider>
          <LogoutButton />
        </SessionProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(qc.getQueryData(['employees', 'alpha'])).toBeUndefined(), { timeout: 5000 });
  });

  it('clears the authenticated session and company context on logout', async () => {
    await authRepository.signIn({ email: 'admin@alpha.test', password: 'x' });

    function SessionProbe() {
      const { authenticated, email, logout } = useSession();
      return (
        <>
          <span>{authenticated ? 'authenticated' : 'signed out'}</span>
          <span>{email ?? 'no email'}</span>
          <button onClick={() => void logout()}>logout session</button>
        </>
      );
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'logout session' }));
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText('no email')).toBeInTheDocument();
  });
});

describe('session restoration failure', () => {
  beforeEach(async () => {
    await authRepository.signOut();
    window.history.replaceState({}, '', '/login?portal=admin');
  });

  it('releases auth loading and leaves the user signed out', async () => {
    const getSession = vi.spyOn(authRepository, 'getSession').mockRejectedValueOnce(new Error('offline'));

    function SessionProbe() {
      const { authLoading, authenticated } = useSession();
      return <span>{authLoading ? 'restoring' : authenticated ? 'authenticated' : 'signed out'}</span>;
    }

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument(), { timeout: 5000 });
    expect(getSession).toHaveBeenCalledOnce();
    getSession.mockRestore();
  });
});
