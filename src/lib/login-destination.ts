// ---------------------------------------------------------------------------
// Where a signed-in user belongs, decided in one pure place.
//
// Two paths reach this decision — submitting the login form, and restoring an
// existing session on a login page — and they must agree, or an already
// authenticated visitor could be sent somewhere the sign-in flow would not have
// sent them.
//
// MEMBERSHIP RULE (current product): a user has EXACTLY ONE active company
// membership. `register_company` raises `user_already_member` when an account
// already belongs to a company, and no invite or admin path creates a second
// membership; both read paths (`getActiveMembership`, `getCompanyContext`) use
// `.maybeSingle()` accordingly. The schema's `unique (company_id, user_id)`
// permits multiple rows in principle, but nothing produces them today — so
// there is deliberately NO workspace picker. If multi-membership ever becomes
// reachable, this is the function to change: it would return a `choose`
// outcome listing only the caller's own memberships.
// ---------------------------------------------------------------------------

export type LoginDestination =
  /** Platform Super Admin — the admin console, never a company workspace. */
  | { kind: 'admin' }
  /** The authenticated user's own workspace dashboard. */
  | { kind: 'workspace'; slug: string; hintIgnored: boolean }
  /** Authenticated, but no active company membership — cannot enter anywhere. */
  | { kind: 'no-membership' }
  /** A platform admin signed in through the company login (policy violation). */
  | { kind: 'admin-on-company-login' };

export interface LoginContext {
  isPlatformAdmin: boolean;
  /** True when the login page was opened as `?portal=admin`. */
  isAdminPortal: boolean;
  /** Slug from the authenticated membership — the ONLY authorization source. */
  membershipSlug: string | null;
  /** `?tenant=` from the URL: a routing hint, never an authorization source. */
  requestedTenant: string | null;
}

/**
 * Resolve the post-authentication destination.
 *
 * The `?tenant=` hint is deliberately powerless. It can never grant access to a
 * workspace, never change which workspace is opened, and never turn a valid
 * sign-in into an error. When it disagrees with the authenticated membership it
 * is discarded and reported via `hintIgnored`, so the UI can explain the
 * outcome without disclosing anything about the company that was named.
 */
export function resolveLoginDestination(ctx: LoginContext): LoginDestination {
  if (ctx.isAdminPortal) {
    return ctx.isPlatformAdmin ? { kind: 'admin' } : { kind: 'no-membership' };
  }

  // A platform admin has no company membership; sending them into a workspace
  // would grant a context they do not belong to.
  if (ctx.isPlatformAdmin) return { kind: 'admin-on-company-login' };

  if (!ctx.membershipSlug) return { kind: 'no-membership' };

  const hint = ctx.requestedTenant?.trim().toLowerCase() || null;
  return {
    kind: 'workspace',
    slug: ctx.membershipSlug,
    hintIgnored: !!hint && hint !== ctx.membershipSlug,
  };
}
