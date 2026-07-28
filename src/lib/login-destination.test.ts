// ---------------------------------------------------------------------------
// Post-authentication destination + canonical public-host rules.
//
// The security-critical property under test: `?tenant=` is a ROUTING HINT and
// nothing more. It can never grant access, never change which workspace opens,
// and never turn a valid sign-in into a failure.
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { resolveLoginDestination } from './login-destination';
import { canonicalPublicUrl, registrationHandoffUrl, marketingHost } from './tenant';

const DOMAIN = 'merbsconnect.com';

describe('resolveLoginDestination — membership is the only authorization source', () => {
  it('opens the member’s own workspace when no tenant hint is present', () => {
    // Lacking ?tenant= is normal, not an error: the generic public login is the
    // primary entry point and must not require knowing your subdomain.
    expect(
      resolveLoginDestination({
        isPlatformAdmin: false,
        isAdminPortal: false,
        membershipSlug: 'james',
        requestedTenant: null,
      }),
    ).toEqual({ kind: 'workspace', slug: 'james', hintIgnored: false });
  });

  it('honours a hint that agrees with the membership', () => {
    expect(
      resolveLoginDestination({
        isPlatformAdmin: false,
        isAdminPortal: false,
        membershipSlug: 'james',
        requestedTenant: 'james',
      }),
    ).toEqual({ kind: 'workspace', slug: 'james', hintIgnored: false });
  });

  it('a WRONG hint cannot override the authenticated membership', () => {
    // ?tenant=kimhr while the account belongs to james: kimhr must never open,
    // and the mismatch must not be reported as a failed sign-in.
    const result = resolveLoginDestination({
      isPlatformAdmin: false,
      isAdminPortal: false,
      membershipSlug: 'james',
      requestedTenant: 'kimhr',
    });
    expect(result).toEqual({ kind: 'workspace', slug: 'james', hintIgnored: true });
    expect(JSON.stringify(result)).not.toContain('kimhr');
  });

  it('normalizes hint casing and whitespace before comparing', () => {
    expect(
      resolveLoginDestination({
        isPlatformAdmin: false,
        isAdminPortal: false,
        membershipSlug: 'james',
        requestedTenant: '  JAMES ',
      }),
    ).toEqual({ kind: 'workspace', slug: 'james', hintIgnored: false });
  });

  it('never routes a platform admin into a company workspace', () => {
    expect(
      resolveLoginDestination({
        isPlatformAdmin: true,
        isAdminPortal: false,
        membershipSlug: null,
        requestedTenant: 'james',
      }),
    ).toEqual({ kind: 'admin-on-company-login' });
  });

  it('sends a platform admin on the admin portal to the console', () => {
    expect(
      resolveLoginDestination({
        isPlatformAdmin: true,
        isAdminPortal: true,
        membershipSlug: null,
        requestedTenant: null,
      }),
    ).toEqual({ kind: 'admin' });
  });

  it('refuses a non-admin signing in through the admin portal', () => {
    expect(
      resolveLoginDestination({
        isPlatformAdmin: false,
        isAdminPortal: true,
        membershipSlug: 'james',
        requestedTenant: null,
      }),
    ).toEqual({ kind: 'no-membership' });
  });

  it('reports no-membership rather than inventing a workspace from the hint', () => {
    // The single most important negative case: a hint must not become access.
    expect(
      resolveLoginDestination({
        isPlatformAdmin: false,
        isAdminPortal: false,
        membershipSlug: null,
        requestedTenant: 'james',
      }),
    ).toEqual({ kind: 'no-membership' });
  });
});

describe('canonicalPublicUrl — public hosts', () => {
  it('leaves the generic login on the marketing host alone', () => {
    expect(canonicalPublicUrl(`home.${DOMAIN}`, '/login', '', DOMAIN)).toBeNull();
  });

  it('leaves the marketing login alone even WITH a tenant hint', () => {
    // home/login?tenant=james stays put and resolves after authentication.
    expect(canonicalPublicUrl(`home.${DOMAIN}`, '/login', '?tenant=james', DOMAIN)).toBeNull();
  });

  it('leaves a matching company login on its own host', () => {
    expect(canonicalPublicUrl(`james.${DOMAIN}`, '/login', '', DOMAIN)).toBeNull();
    expect(canonicalPublicUrl(`james.${DOMAIN}`, '/login', '?tenant=james', DOMAIN)).toBeNull();
  });

  it('moves registration off a tenant host to the marketing host', () => {
    expect(canonicalPublicUrl(`kimhr.${DOMAIN}`, '/register', '', DOMAIN)).toBe(`https://home.${DOMAIN}/register`);
  });

  it('resolves a contradictory host+hint to the hinted company host', () => {
    // kimhr.<domain>/login?tenant=james -> james.<domain>/login
    expect(canonicalPublicUrl(`kimhr.${DOMAIN}`, '/login', '?tenant=james', DOMAIN)).toBe(
      `https://james.${DOMAIN}/login`,
    );
  });

  it('never redirects hosts without real subdomains (dev, previews)', () => {
    for (const host of ['localhost', '127.0.0.1', 'preview-abc.vercel.app']) {
      expect(canonicalPublicUrl(host, '/register', '', DOMAIN)).toBeNull();
      expect(canonicalPublicUrl(host, '/login', '?tenant=james', DOMAIN)).toBeNull();
    }
  });

  it('cannot loop: every emitted target is already canonical', () => {
    // Feed each redirect target back in; a second pass must produce null.
    const first = canonicalPublicUrl(`kimhr.${DOMAIN}`, '/login', '?tenant=james', DOMAIN);
    expect(first).toBe(`https://james.${DOMAIN}/login`);
    expect(canonicalPublicUrl(`james.${DOMAIN}`, '/login', '', DOMAIN)).toBeNull();

    const second = canonicalPublicUrl(`kimhr.${DOMAIN}`, '/register', '', DOMAIN);
    expect(second).toBe(`https://home.${DOMAIN}/register`);
    expect(canonicalPublicUrl(`home.${DOMAIN}`, '/register', '', DOMAIN)).toBeNull();
  });

  it('exposes the marketing host used for public routes', () => {
    expect(marketingHost(DOMAIN)).toBe(`home.${DOMAIN}`);
  });
});

describe('registrationHandoffUrl', () => {
  it('prefers the new company’s own login host', () => {
    expect(registrationHandoffUrl('james', `home.${DOMAIN}`, DOMAIN)).toBe(`https://james.${DOMAIN}/login`);
  });

  it('never emits a third company’s host carrying another slug', () => {
    // Even when the founder somehow registered from another tenant's host, the
    // hand-off targets the NEW company, never `other.<domain>/login?tenant=...`.
    const url = registrationHandoffUrl('james', `kimhr.${DOMAIN}`, DOMAIN);
    expect(url).toBe(`https://james.${DOMAIN}/login`);
    expect(url).not.toContain('kimhr');
  });

  it('falls back to the public hand-off in dev', () => {
    expect(registrationHandoffUrl('james', 'localhost', DOMAIN)).toBeNull();
  });
});
