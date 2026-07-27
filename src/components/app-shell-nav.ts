/**
 * A portal dashboard is an exact destination; its child routes belong to the
 * more specific navigation item. Other items may own nested detail routes.
 */
export function isNavItemActive(pathname: string, to: string) {
  // A dashboard is an exact destination. It is `/admin` for the platform portal
  // and `/:companySlug/dashboard` for a company workspace, so match either form.
  if (to === '/admin' || to.endsWith('/dashboard')) return pathname === to || pathname === `${to}/`;
  return pathname === to || pathname.startsWith(`${to}/`);
}
