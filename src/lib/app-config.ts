// ---------------------------------------------------------------------------
// Public app configuration (non-secret). The workspace host is used only to
// preview tenant URLs (e.g. `multi-tenant-hr.vercel.app/rich/dashboard`). It is
// a deployment host, not a company identity, and can be overridden per env.
// ---------------------------------------------------------------------------

export const WORKSPACE_HOST = import.meta.env.VITE_WORKSPACE_HOST ?? 'multi-tenant-hr.vercel.app';
