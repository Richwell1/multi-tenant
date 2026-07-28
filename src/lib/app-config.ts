// ---------------------------------------------------------------------------
// Public app configuration (non-secret). Used only to preview tenant workspace
// URLs during registration (e.g. `acme.merbsconnect.com`) — a deployment host,
// not a company identity. See src/lib/tenant.ts for the authoritative
// VITE_APP_DOMAIN-backed base domain and hostname resolution.
// ---------------------------------------------------------------------------

import { appBaseDomain } from './tenant';

/** The public hostname for a company's workspace, e.g. `acme.merbsconnect.com`. */
export function workspaceHost(slug: string): string {
  return `${slug}.${appBaseDomain()}`;
}
