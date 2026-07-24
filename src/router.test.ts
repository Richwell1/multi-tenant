import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory } from '@tanstack/react-router';
import { router, routeTree } from './router';

const EXPECTED_ROUTES = [
  '/login',
  '/register',
  '/access-denied',
  '/company-suspended',
  '/admin',
  '/admin/companies',
  '/admin/companies/$companyId',
  '/admin/requests',
  '/admin/requests/new',
  '/admin/requests/$requestId',
  '/admin/packages',
  '/admin/packages/new',
  '/admin/packages/$packageId',
  '/admin/diagnostics/$diagnosticId',
  '/admin/installations',
  '/admin/usage',
  '/admin/health',
  '/admin/audit',
  '/dashboard',
  '/employees',
  '/employees/new',
  '/employees/$employeeId',
  '/departments',
  '/positions',
  '/updates',
  '/packages',
  '/users',
  '/settings',
  '/leave',
  '/attendance',
];

describe('route inventory', () => {
  // Assert on navigable fullPath (URL), not internal route ids — the pathless
  // workspace layout prefixes ids with "/workspace" but does not affect the URL.
  const paths = new Set(
    Object.values(router.routesById)
      .map((r) => r.fullPath as string)
      .filter(Boolean),
  );

  it('registers every required route', () => {
    for (const route of EXPECTED_ROUTES) {
      expect(paths, `missing route: ${route}`).toContain(route);
    }
  });

  it('registers all 30 app routes', () => {
    expect(EXPECTED_ROUTES.length).toBe(30);
  });
});

describe('root redirect', () => {
  it('redirects / to /login?portal=admin', async () => {
    const r = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await r.load();
    expect(r.state.location.pathname).toBe('/login');
    expect(r.state.location.search).toEqual({ portal: 'admin' });
  });

  it('does not redirect /login (no loop)', async () => {
    const r = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/login?portal=admin'] }),
    });
    await r.load();
    expect(r.state.location.pathname).toBe('/login');
  });
});
