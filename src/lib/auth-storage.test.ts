// ---------------------------------------------------------------------------
// Shared parent-domain auth storage.
//
// The property under test is the one the production bug violated: a session
// written on one host must be readable on a sibling host — while a look-alike
// domain must never be able to claim the shared cookie, and a failed migration
// must never destroy someone's existing session.
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from 'vitest';
import {
  canUseSharedCookie,
  createSharedAuthStorage,
  MAX_COOKIE_VALUE_BYTES,
  type CookieAccess,
  type SupportedStorage,
} from './auth-storage';

const BASE = 'merbsconnect.com';
const KEY = 'sb-abcdefghijklmnop-auth-token';

/**
 * A cookie jar that honours Domain scoping, so "readable on a sibling host" is
 * actually proven rather than assumed. Records the raw attribute strings too.
 */
function jar() {
  const store = new Map<string, { value: string; domain: string | null; attrs: string }>();

  const accessFor = (hostname: string): CookieAccess => ({
    read: () =>
      [...store.entries()]
        .filter(([, c]) => {
          if (!c.domain) return true; // host-only: visible to the writer's host
          const d = c.domain.replace(/^\./, '');
          return hostname === d || hostname.endsWith(`.${d}`);
        })
        .map(([name, c]) => `${name}=${c.value}`)
        .join('; '),
    write: (serialized) => {
      const [pair, ...rest] = serialized.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const attrs = rest.join('; ');
      const domain = /Domain=([^;]+)/i.exec(attrs)?.[1] ?? null;
      if (/Max-Age=0\b/.test(attrs)) store.delete(name);
      else store.set(name, { value, domain, attrs });
    },
  });

  return { store, accessFor };
}

function memoryStorage(seed: Record<string, string> = {}): SupportedStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const session = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ access_token: 'a'.repeat(800), refresh_token: 'r'.repeat(24), ...over });

describe('canUseSharedCookie — domain boundary', () => {
  it('accepts the base domain and its subdomains', () => {
    for (const host of [BASE, `home.${BASE}`, `admin.${BASE}`, `kimhr.${BASE}`]) {
      expect(canUseSharedCookie(host, BASE)).toBe(true);
    }
  });

  it('rejects look-alike and suffix-attack domains', () => {
    for (const host of [
      `evil${BASE}`, // no dot boundary
      `${BASE}.attacker.test`, // base as a prefix
      'merbsconnect.co',
      'localhost',
      'preview-abc.vercel.app',
    ]) {
      expect(canUseSharedCookie(host, BASE)).toBe(false);
    }
  });
});

describe('shared session across subdomains', () => {
  let cookies: ReturnType<typeof jar>;
  const storageOn = (hostname: string, legacy: SupportedStorage | null = null) =>
    createSharedAuthStorage({
      hostname,
      baseDomain: BASE,
      secure: true,
      cookies: cookies.accessFor(hostname),
      legacy,
    });

  beforeEach(() => {
    cookies = jar();
  });

  it('a session written on the public host is readable on a tenant host', () => {
    // This is the exact production failure.
    storageOn(`home.${BASE}`).setItem(KEY, session());
    expect(storageOn(`kimhr.${BASE}`).getItem(KEY)).toBe(session());
  });

  it('is readable on the admin host too', () => {
    storageOn(`home.${BASE}`).setItem(KEY, session());
    expect(storageOn(`admin.${BASE}`).getItem(KEY)).toBe(session());
  });

  it('a direct tenant sign-in is visible back on the public host', () => {
    storageOn(`kimhr.${BASE}`).setItem(KEY, session());
    expect(storageOn(`home.${BASE}`).getItem(KEY)).toBe(session());
  });

  it('a token refresh on one host is seen by the others', () => {
    storageOn(`home.${BASE}`).setItem(KEY, session({ access_token: 'old' }));
    storageOn(`kimhr.${BASE}`).setItem(KEY, session({ access_token: 'refreshed' }));
    expect(storageOn(`home.${BASE}`).getItem(KEY)).toContain('refreshed');
  });

  it('sign-out on any host clears the session everywhere', () => {
    storageOn(`home.${BASE}`).setItem(KEY, session());
    storageOn(`kimhr.${BASE}`).removeItem(KEY);
    expect(storageOn(`home.${BASE}`).getItem(KEY)).toBeNull();
    expect(storageOn(`admin.${BASE}`).getItem(KEY)).toBeNull();
  });

  it('uses the parent domain and correct attributes in production', () => {
    storageOn(`home.${BASE}`).setItem(KEY, session());
    const [, cookie] = [...cookies.store.entries()][0];
    expect(cookie.domain).toBe(`.${BASE}`);
    expect(cookie.attrs).toContain('Path=/');
    expect(cookie.attrs).toContain('SameSite=Lax');
    expect(cookie.attrs).toContain('Secure');
    expect(cookie.attrs).toMatch(/Max-Age=\d+/);
  });

  it('omits Secure over plain http so the cookie is not dropped', () => {
    createSharedAuthStorage({
      hostname: `home.${BASE}`,
      baseDomain: BASE,
      secure: false,
      cookies: cookies.accessFor(`home.${BASE}`),
    }).setItem(KEY, session());
    expect([...cookies.store.values()][0].attrs).not.toContain('Secure');
  });

  it('never sets the production Domain on localhost', () => {
    const local = jar();
    createSharedAuthStorage({
      hostname: 'localhost',
      baseDomain: BASE,
      secure: false,
      cookies: local.accessFor('localhost'),
    }).setItem(KEY, session());
    const cookie = [...local.store.values()][0];
    expect(cookie.domain).toBeNull();
    expect(cookie.attrs).not.toContain(BASE);
  });

  it('keeps a look-alike host from writing into the shared domain', () => {
    const evil = jar();
    createSharedAuthStorage({
      hostname: `evil${BASE}`,
      baseDomain: BASE,
      secure: true,
      cookies: evil.accessFor(`evil${BASE}`),
    }).setItem(KEY, session());
    expect([...evil.store.values()][0].domain).toBeNull();
  });
});

describe('size handling and chunking', () => {
  let cookies: ReturnType<typeof jar>;
  const storage = () =>
    createSharedAuthStorage({
      hostname: `home.${BASE}`,
      baseDomain: BASE,
      secure: true,
      cookies: cookies.accessFor(`home.${BASE}`),
    });

  beforeEach(() => {
    cookies = jar();
  });

  it('stores a realistically sized session in a single cookie', () => {
    // Measured against the real hosted project: ~2.7KB encoded.
    const realistic = session();
    expect(encodeURIComponent(realistic).length).toBeLessThan(MAX_COOKIE_VALUE_BYTES);
    storage().setItem(KEY, realistic);
    expect(cookies.store.size).toBe(1);
    expect(storage().getItem(KEY)).toBe(realistic);
  });

  it('chunks an oversized session without truncating it', () => {
    const huge = session({ access_token: 'x'.repeat(12_000) });
    storage().setItem(KEY, huge);
    expect(cookies.store.size).toBeGreaterThan(1);
    // Round-trips byte-for-byte — nothing silently dropped.
    expect(storage().getItem(KEY)).toBe(huge);
  });

  it('keeps every chunk within the per-cookie budget', () => {
    storage().setItem(KEY, session({ access_token: 'y'.repeat(20_000) }));
    for (const cookie of cookies.store.values()) {
      expect(cookie.value.length).toBeLessThanOrEqual(MAX_COOKIE_VALUE_BYTES);
    }
  });

  it('chunks multi-byte characters by ENCODED size', () => {
    // A single emoji encodes to 12 bytes; slicing raw would overflow.
    const wide = session({ access_token: '😀'.repeat(2000) });
    storage().setItem(KEY, wide);
    for (const cookie of cookies.store.values()) {
      // The jar holds the already-encoded value, exactly as document.cookie does.
      expect(cookie.value.length).toBeLessThanOrEqual(MAX_COOKIE_VALUE_BYTES);
      // No chunk may end on a lone surrogate, or decoding blows up.
      expect(() => decodeURIComponent(cookie.value)).not.toThrow();
    }
    expect(storage().getItem(KEY)).toBe(wide);
  });

  it('does not leave chunked and single representations coexisting', () => {
    storage().setItem(KEY, session({ access_token: 'z'.repeat(12_000) }));
    expect(cookies.store.size).toBeGreaterThan(1);
    const small = session();
    storage().setItem(KEY, small);
    expect(cookies.store.size).toBe(1);
    expect(storage().getItem(KEY)).toBe(small);
  });

  it('removes every chunk on sign-out', () => {
    storage().setItem(KEY, session({ access_token: 'q'.repeat(12_000) }));
    storage().removeItem(KEY);
    expect(cookies.store.size).toBe(0);
    expect(storage().getItem(KEY)).toBeNull();
  });
});

describe('legacy localStorage migration', () => {
  let cookies: ReturnType<typeof jar>;
  const storage = (legacy: SupportedStorage | null) =>
    createSharedAuthStorage({
      hostname: `home.${BASE}`,
      baseDomain: BASE,
      secure: true,
      cookies: cookies.accessFor(`home.${BASE}`),
      legacy,
    });

  beforeEach(() => {
    cookies = jar();
  });

  it('promotes an existing localStorage session into the shared cookie once', () => {
    const legacy = memoryStorage({ [KEY]: session() });

    expect(storage(legacy).getItem(KEY)).toBe(session());

    // Copied to the cookie and the origin-scoped copy retired.
    expect(legacy.data.has(KEY)).toBe(false);
    expect(storage(null).getItem(KEY)).toBe(session());
    // And it is now visible on a sibling host — the point of the migration.
    expect(
      createSharedAuthStorage({
        hostname: `kimhr.${BASE}`,
        baseDomain: BASE,
        secure: true,
        cookies: cookies.accessFor(`kimhr.${BASE}`),
      }).getItem(KEY),
    ).toBe(session());
  });

  it('does not re-migrate on subsequent reads', () => {
    const legacy = memoryStorage({ [KEY]: session() });
    const s = storage(legacy);
    s.getItem(KEY);
    legacy.setItem(KEY, session({ access_token: 'STALE' }));
    // The cookie already wins, so the stale legacy value is never promoted.
    expect(s.getItem(KEY)).not.toContain('STALE');
  });

  it('never deletes malformed legacy data', () => {
    const legacy = memoryStorage({ [KEY]: 'not-json{' });
    expect(storage(legacy).getItem(KEY)).toBeNull();
    // Left intact — a failed migration must not cost a session.
    expect(legacy.data.get(KEY)).toBe('not-json{');
  });

  it('rejects legacy data that is JSON but not a session', () => {
    const legacy = memoryStorage({ [KEY]: JSON.stringify({ hello: 'world' }) });
    expect(storage(legacy).getItem(KEY)).toBeNull();
    expect(legacy.data.has(KEY)).toBe(true);
  });

  it('clears the legacy entry on sign-out so it cannot resurrect a session', () => {
    const legacy = memoryStorage({ [KEY]: session() });
    storage(legacy).removeItem(KEY);
    expect(legacy.data.has(KEY)).toBe(false);
    expect(storage(legacy).getItem(KEY)).toBeNull();
  });

  it('tolerates an absent legacy store', () => {
    expect(() => storage(null).getItem(KEY)).not.toThrow();
    expect(storage(null).getItem(KEY)).toBeNull();
  });
});

describe('malformed cookie data', () => {
  it('ignores junk cookies without throwing', () => {
    const cookies: CookieAccess = {
      read: () => 'malformed; =novalue; other=fine',
      write: () => {},
    };
    const s = createSharedAuthStorage({ hostname: `home.${BASE}`, baseDomain: BASE, secure: true, cookies });
    expect(s.getItem(KEY)).toBeNull();
  });

  it('never stores tokens under a predictable non-auth name', () => {
    const cookies = jar();
    createSharedAuthStorage({
      hostname: `home.${BASE}`,
      baseDomain: BASE,
      secure: true,
      cookies: cookies.accessFor(`home.${BASE}`),
    }).setItem(KEY, session());
    // Only the Supabase-derived key is used; no extra copies are written.
    expect([...cookies.store.keys()]).toEqual([KEY]);
  });
});
