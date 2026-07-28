// ---------------------------------------------------------------------------
// Tenant + portal resolution.
//
// Package entitlements live in '@/lib/entitlements' + '@/hooks/entitlements'
// (sourced from the membership context), not here.
//
// Context is derived from the hostname and query string:
//   home.<domain>, www.<domain>, admin.<domain>, or the bare app domain
//                                -> Platform Super Admin / marketing portal
//   /login?portal=admin         -> Platform Super Admin portal (dev override)
//   /login?tenant=<company-slug> -> that company's workspace (dev override)
//   <company-slug>.<domain>     -> that company's workspace (wildcard subdomain)
//
// The base app domain is VITE_APP_DOMAIN (falls back to merbsconnect.com). Any
// other host (localhost, a preview deployment host, …) never matches a tenant
// subdomain, so local dev keeps using the `?tenant=<slug>` query override with
// path-based routing (see workspacePath() and router.tsx).
// ---------------------------------------------------------------------------

import type { Company, Portal } from '@/data/types';
import { companies } from '@/data/mock';

export interface ResolvedContext {
  portal: Portal;
  /** Tenant id when portal === 'company'; null for admin. */
  tenantId: string | null;
}

const DEFAULT_APP_DOMAIN = 'merbsconnect.com';
/** The subdomain that hosts marketing, login/register, and Platform Admin. */
export const MARKETING_SUBDOMAIN = 'home';
/** Subdomains that are never a tenant, even though they sit on the app domain. */
const NON_TENANT_SUBDOMAINS = new Set([MARKETING_SUBDOMAIN, 'www', 'admin']);

/** The app's base domain, e.g. `merbsconnect.com` — configurable per environment. */
export function appBaseDomain(): string {
  const configured = (import.meta.env.VITE_APP_DOMAIN as string | undefined)?.trim().toLowerCase();
  return configured || DEFAULT_APP_DOMAIN;
}

/**
 * True when `hostname` is a live tenant workspace subdomain (e.g.
 * `acme.merbsconnect.com`) — as opposed to the marketing/admin host, the bare
 * app domain, or an unrelated host (localhost, a preview deployment, …).
 */
export function isTenantHost(hostname: string, baseDomain = appBaseDomain()): boolean {
  const host = hostname.trim().toLowerCase();
  const suffix = `.${baseDomain}`;
  if (host === baseDomain || !host.endsWith(suffix)) return false;
  const sub = host.slice(0, -suffix.length);
  // A bare, single-label subdomain only — `foo.acme.merbsconnect.com` is not
  // a recognized tenant host shape.
  return sub.length > 0 && !sub.includes('.') && !NON_TENANT_SUBDOMAINS.has(sub);
}

/**
 * Resolve portal + tenant from a hostname and optional query string. In
 * production, the tenant subdomain is authoritative; `?tenant=<slug>` remains
 * a dev-only override since local dev has no real wildcard subdomains.
 */
export function resolveContext(hostname: string, search = ''): ResolvedContext {
  const params = new URLSearchParams(search);

  const portalParam = params.get('portal');
  if (portalParam === 'admin') return { portal: 'admin', tenantId: null };

  const tenantParam = params.get('tenant')?.trim().toLowerCase();
  if (tenantParam) {
    // Dev override — supports any registration-created company slug without a
    // real subdomain.
    return { portal: 'company', tenantId: tenantParam };
  }

  if (isTenantHost(hostname)) {
    const sub = hostname.trim().toLowerCase().split('.')[0];
    return { portal: 'company', tenantId: sub };
  }

  return { portal: 'admin', tenantId: null };
}

/** True when `hostname` is the app domain itself or any of its subdomains. */
export function isAppHost(hostname: string, baseDomain = appBaseDomain()): boolean {
  const host = hostname.trim().toLowerCase();
  return host === baseDomain || host.endsWith(`.${baseDomain}`);
}

/**
 * Build a workspace path for `slug`, for use INSIDE an already-resolved
 * workspace (e.g. WorkspaceShell nav links) — the caller is always already on
 * the right host. On a real tenant subdomain the slug is already implied by
 * the host, so the path has no prefix; in dev (or any non-tenant host) it
 * falls back to the `/:companySlug/...` path segment. `path` must start with
 * `/`, e.g. `workspacePath('acme', '/dashboard')`.
 */
export function workspacePath(
  slug: string,
  path: string,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): string {
  return isTenantHost(hostname) ? path : `/${slug}${path}`;
}

/**
 * Resolve where to send the browser for `slug`'s workspace `path`, from
 * WHATEVER host the browser is currently on — used to cross from the
 * marketing/admin host (e.g. after signing in on home.<domain>) into a
 * tenant's own subdomain. Same-origin routing (a router `navigate`) is used
 * when already on that tenant's host or on a host with no real subdomains
 * (local dev, a preview deployment); everywhere else on the app domain — e.g.
 * home.<domain> — client-side routing cannot cross origins, so a full
 * `https://<slug>.<domain>/...` URL is returned instead. Callers must check
 * for an absolute URL (`startsWith('http')`) and use `window.location.href`
 * for that case rather than router navigation.
 */
export function resolveWorkspaceDestination(
  slug: string,
  path: string,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): string {
  const host = hostname.trim().toLowerCase();
  if (isTenantHost(host) || !isAppHost(host)) return workspacePath(slug, path, host);
  // Every real host on the app domain is served over HTTPS (Cloudflare
  // Universal SSL); never emit an http:// cross-origin redirect.
  return `https://${slug}.${appBaseDomain()}${path}`;
}

/** The public host for marketing, registration, and the generic login. */
export function marketingHost(baseDomain = appBaseDomain()): string {
  return `${MARKETING_SUBDOMAIN}.${baseDomain}`;
}

/**
 * Canonical host for a PUBLIC route (`/login`, `/register`), or null when the
 * current host is already canonical and the browser should stay put.
 *
 * The generic login on the marketing host is a first-class entry point: a user
 * must never need to know their subdomain to sign in, so `home.<domain>/login`
 * is always canonical, with or without a `?tenant=` hint. Only two situations
 * need a move:
 *
 *   <tenant>.<domain>/register         -> home.<domain>/register
 *     Registration creates a NEW company; performing it under some existing
 *     tenant's host is meaningless and would imply a relationship to it.
 *
 *   <tenant>.<domain>/login?tenant=b   -> b.<domain>/login
 *     A hint that disagrees with the host is contradictory. The hint names the
 *     workspace the user is trying to reach, so honour it and drop the stale
 *     host rather than showing company A's branding for a company B sign-in.
 *
 * The hint remains a routing hint only — never an authorization source. It is
 * still verified against the authenticated membership after sign-in.
 *
 * Returns an absolute `https://` URL because these are cross-origin moves that
 * client-side routing cannot perform. Hosts that are not real app subdomains
 * (localhost, preview deployments) never redirect, so local dev keeps working
 * with `?tenant=<slug>` and path-based routing.
 */
export function canonicalPublicUrl(
  hostname: string,
  pathname: string,
  search = '',
  baseDomain = appBaseDomain(),
): string | null {
  const host = hostname.trim().toLowerCase();
  if (!isTenantHost(host, baseDomain)) return null;

  const currentSlug = host.slice(0, -`.${baseDomain}`.length);
  const path = pathname.toLowerCase();

  if (path === '/register') return `https://${marketingHost(baseDomain)}/register`;

  if (path === '/login') {
    const hint = new URLSearchParams(search).get('tenant')?.trim().toLowerCase();
    // A hint naming a DIFFERENT company wins over the host it was opened on.
    if (hint && hint !== currentSlug) return `https://${hint}.${baseDomain}/login`;
  }

  return null;
}

/**
 * Where "Continue to sign in" should send a founder after registration.
 *
 * Prefers the new company's OWN login host (`https://<slug>.<domain>/login`),
 * so the very first sign-in already happens under the tenant that was just
 * created. Returns null on hosts with no real subdomains (local dev, previews),
 * where the caller falls back to the public hand-off
 * `/login?tenant=<slug>` — equally valid, since the hint is verified against
 * the authenticated membership either way.
 *
 * What this must never produce is a third company's host carrying someone
 * else's slug (`other.<domain>/login?tenant=<slug>`): the host is always either
 * the marketing host or the matching company's own.
 */
export function registrationHandoffUrl(
  slug: string,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
  baseDomain = appBaseDomain(),
): string | null {
  return isAppHost(hostname, baseDomain) ? `https://${slug}.${baseDomain}/login` : null;
}

export function getCompany(tenantId: string | null): Company | undefined {
  if (!tenantId) return undefined;
  return companies.find((c) => c.id === tenantId);
}
