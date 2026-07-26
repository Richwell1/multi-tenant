import { describe, expect, it } from 'vitest';
import { isNavItemActive } from './app-shell-nav';

describe('isNavItemActive', () => {
  it('keeps a dashboard active only on its own route', () => {
    expect(isNavItemActive('/admin', '/admin')).toBe(true);
    expect(isNavItemActive('/admin/packages', '/admin')).toBe(false);
    expect(isNavItemActive('/dashboard/employees', '/dashboard')).toBe(false);
  });

  it('allows detail routes to remain owned by their parent item', () => {
    expect(isNavItemActive('/admin/packages', '/admin/packages')).toBe(true);
    expect(isNavItemActive('/admin/packages/hr-core', '/admin/packages')).toBe(true);
    expect(isNavItemActive('/admin/companies', '/admin/packages')).toBe(false);
  });
});
