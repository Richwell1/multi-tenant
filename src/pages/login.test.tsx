import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';
import { SessionProvider } from '@/lib/session';
import { routeTree } from '@/router';

// SessionProvider resolves portal/tenant from window.location once at mount, so
// we point the URL at the desired login context before rendering.
function renderLoginAt(url: string) {
  window.history.replaceState({}, '', url);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/login'] }),
  });
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe('reusable LoginPage — portal-derived registration', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));

  it('Platform Super Admin login shows Platform Administration and NO registration', async () => {
    renderLoginAt('/login?portal=admin');
    expect(await screen.findByText('Platform Administration')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /register/i })).toBeNull();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('Alpha company login shows the company name and a Register Company link', async () => {
    renderLoginAt('/login?tenant=alpha');
    expect(await screen.findByText('Alpha Trading')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register company/i })).toBeInTheDocument();
  });

  it('Beta company login shows the company name and a Register Company link', async () => {
    renderLoginAt('/login?tenant=beta');
    expect(await screen.findByText('Beta Manufacturing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register company/i })).toBeInTheDocument();
  });
});
