/**
 * A portal dashboard is an exact destination; its child routes belong to the
 * more specific navigation item. Other items may own nested detail routes.
 */
export function isNavItemActive(pathname: string, to: string) {
  if (to === '/admin' || to === '/dashboard') return pathname === to || pathname === `${to}/`;
  return pathname === to || pathname.startsWith(`${to}/`);
}
