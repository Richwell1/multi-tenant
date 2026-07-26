import { describe, it, expect, beforeEach } from 'vitest';
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
    await waitFor(() => expect(at(router)).toBe('/login'));
  });

  it('company user cannot access /admin → /access-denied', async () => {
    const router = await renderGuarded({ path: '/admin', url: '/login?portal=admin', email: 'company-user@x.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'));
  });

  it('active platform admin can access /admin', async () => {
    const router = await renderGuarded({ path: '/admin', url: '/login?portal=admin', email: 'super@platform.test' });
    await waitFor(() => expect(at(router)).toBe('/admin'));
  });

  it('Alpha member can access Alpha workspace', async () => {
    const router = await renderGuarded({ path: '/dashboard', url: '/login?tenant=alpha', email: 'admin@alpha.test' });
    await waitFor(() => expect(at(router)).toBe('/dashboard'));
  });

  it('shared login allows a company member without a tenant query', async () => {
    const router = await renderGuarded({ path: '/dashboard', url: '/login', email: 'admin@beta.test' });
    await waitFor(() => expect(at(router)).toBe('/dashboard'));
  });

  it('Alpha tenant + Beta member → /access-denied (tenant mismatch)', async () => {
    const router = await renderGuarded({ path: '/dashboard', url: '/login?tenant=alpha', email: 'admin@beta.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'));
  });

  it('suspended company → /company-suspended', async () => {
    const router = await renderGuarded({ path: '/dashboard', url: '/login?tenant=gamma', email: 'admin@gamma.test' });
    await waitFor(() => expect(at(router)).toBe('/company-suspended'));
  });

  it('inactive membership → /access-denied', async () => {
    const router = await renderGuarded({ path: '/dashboard', url: '/login?tenant=alpha', email: 'inactive@alpha.test' });
    await waitFor(() => expect(at(router)).toBe('/access-denied'));
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
    await waitFor(() => expect(qc.getQueryData(['employees', 'alpha'])).toBeUndefined());
  });
});
