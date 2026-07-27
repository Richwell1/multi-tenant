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
  // Company workspace routes are prefixed with the tenant slug segment.
  '/$companySlug/dashboard',
  '/$companySlug/employees',
  '/$companySlug/employees/new',
  '/$companySlug/employees/$employeeId',
  '/$companySlug/departments',
  '/$companySlug/positions',
  '/$companySlug/updates',
  '/$companySlug/packages',
  '/$companySlug/users',
  '/$companySlug/settings',
  '/$companySlug/leave',
  '/$companySlug/attendance',
];

describe('route inventory', () => {
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

  it('scopes every company workspace route under the tenant slug, and no admin route', () => {
    const companyRoutes = [...paths].filter((p) => p.startsWith('/$companySlug/'));
    // The workspace page group (dashboard, employees, extensions, …) is prefixed.
    expect(companyRoutes.length).toBeGreaterThanOrEqual(12);
    // Platform Admin routes must never live under a company slug.
    expect([...paths].some((p) => p.startsWith('/$companySlug/admin'))).toBe(false);
    for (const p of paths) {
      if (p.startsWith('/admin')) expect(p.startsWith('/$companySlug')).toBe(false);
    }
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
