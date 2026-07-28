import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Router.tsx decides its route-tree SHAPE once, at module-evaluation time,
// from window.location.hostname (see `onTenantSubdomain` in router.tsx). This
// file verifies the production/tenant-subdomain shape: workspace routes
// mounted at root (no `/$companySlug` prefix), since the hostname already
// implies the tenant. src/router.test.ts covers the dev/path-based shape.
describe('route inventory — tenant subdomain (production)', () => {
  let paths: Set<string>;

  beforeAll(async () => {
    vi.stubGlobal('location', {
      hostname: 'acme.merbsconnect.com',
      href: 'https://acme.merbsconnect.com/dashboard',
      pathname: '/dashboard',
      search: '',
      protocol: 'https:',
    });
    vi.resetModules();
    const { router } = await import('./router');
    paths = new Set(
      Object.values(router.routesById)
        .map((r) => r.fullPath as string)
        .filter(Boolean),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('mounts workspace routes at root, with no $companySlug prefix', () => {
    for (const p of ['/dashboard', '/employees', '/departments', '/positions', '/settings']) {
      expect(paths, `missing route: ${p}`).toContain(p);
    }
    expect([...paths].some((p) => p.startsWith('/$companySlug'))).toBe(false);
  });

  it('still serves public and Platform Admin routes unprefixed', () => {
    for (const p of ['/login', '/register', '/access-denied', '/company-suspended', '/admin']) {
      expect(paths, `missing route: ${p}`).toContain(p);
    }
  });

  it('does not register a bare-workspace-root route (indexRoute owns `/` instead)', () => {
    // wsIndex is omitted entirely on a tenant subdomain — a route tree with a
    // colliding duplicate `/` would have thrown during addChildren() above,
    // so a successful import already proves there is no collision.
    expect(paths).toContain('/');
  });
});
