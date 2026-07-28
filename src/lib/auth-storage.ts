// ---------------------------------------------------------------------------
// Shared Supabase Auth storage across the app's subdomains.
//
// THE BUG THIS FIXES: the Supabase browser client defaults to `persistSession`
// in localStorage, which is ORIGIN-scoped. A session created on
// home.<domain> is invisible to <slug>.<domain>, so signing in on the public
// login and being redirected to the tenant host produced a second login prompt.
//
// THE FIX: persist the session in a cookie scoped to the parent domain
// (`Domain=.<baseDomain>`), which every subdomain can read — home, admin, and
// every tenant host share one session, and a token refresh on any of them is
// immediately visible to the others.
//
// SECURITY POSTURE — read before changing:
//   * The cookie is deliberately NOT HttpOnly. The Supabase browser client must
//     read AND rewrite the access/refresh tokens to keep the session alive, so
//     JavaScript has to reach it. XSS exposure is therefore the same as the
//     localStorage it replaces — this change buys correct cross-subdomain
//     behaviour, NOT stronger token secrecy.
//   * `Domain` is never taken from untrusted input. It is derived from the
//     configured base domain, and the parent-domain cookie is used ONLY when the
//     current host is that domain or one of its subdomains. A look-alike such as
//     `evilmerbsconnect.com` fails the dot-boundary check and falls back to
//     host-local storage.
//   * Sharing a session shares AUTHENTICATION only. Authorization is unchanged:
//     active membership, company UUID matching the host slug, active company,
//     entitlements, and RLS all still apply.
// ---------------------------------------------------------------------------

/** The Supabase storage contract (`getItem`/`setItem`/`removeItem`). */
export interface SupportedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Indirection over `document.cookie` so the adapter is testable in isolation. */
export interface CookieAccess {
  read(): string;
  write(serialized: string): void;
}

export interface AuthStorageOptions {
  hostname: string;
  baseDomain: string;
  /** `Secure` is set only over HTTPS — a Secure cookie is dropped on http://. */
  secure: boolean;
  cookies: CookieAccess;
  /** Legacy origin-scoped store to migrate from, if any. */
  legacy?: SupportedStorage | null;
}

// Browsers cap a cookie at ~4096 bytes INCLUDING name and attributes. Chunk
// well below that so name + `Domain`/`Path`/`SameSite`/`Secure` always fit.
export const MAX_COOKIE_VALUE_BYTES = 3200;

/** Session cookies must outlive the browser session; browsers cap this at 400d. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * True when `hostname` may use a `Domain=.<baseDomain>` cookie. Requires an
 * exact match or a real dot-boundary subdomain, so `evilmerbsconnect.com` and
 * `merbsconnect.com.attacker.test` are both rejected.
 */
export function canUseSharedCookie(hostname: string, baseDomain: string): boolean {
  const host = hostname.trim().toLowerCase();
  const base = baseDomain.trim().toLowerCase();
  if (!host || !base) return false;
  return host === base || host.endsWith(`.${base}`);
}

const encodedLength = (value: string) => encodeURIComponent(value).length;

/**
 * Cookie-backed storage, chunked deterministically.
 *
 * A value that fits is written under `key`. A larger one is split into
 * `key.0`, `key.1`, … and the single-value cookie is removed, so the two
 * representations never coexist. Reads prefer the single cookie and otherwise
 * walk the chunks until one is missing. Nothing is ever silently truncated.
 */
function cookieStorage(opts: AuthStorageOptions): SupportedStorage {
  const shared = canUseSharedCookie(opts.hostname, opts.baseDomain);

  const attributes = (maxAge: number) =>
    [
      `Path=/`,
      // Host-only cookie when the host is not on the app domain (localhost, a
      // preview deployment) — a Domain attribute would simply be rejected.
      shared ? `Domain=.${opts.baseDomain}` : '',
      `Max-Age=${maxAge}`,
      'SameSite=Lax',
      opts.secure ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

  const readAll = (): Map<string, string> => {
    const jar = new Map<string, string>();
    for (const part of opts.cookies.read().split(';')) {
      const raw = part.trim();
      if (!raw) continue;
      const eq = raw.indexOf('=');
      if (eq < 1) continue;
      jar.set(decodeURIComponent(raw.slice(0, eq)), decodeURIComponent(raw.slice(eq + 1)));
    }
    return jar;
  };

  const writeCookie = (name: string, value: string) => {
    opts.cookies.write(
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${attributes(MAX_AGE_SECONDS)}`,
    );
  };

  const deleteCookie = (name: string) => {
    opts.cookies.write(`${encodeURIComponent(name)}=; ${attributes(0)}`);
  };

  const chunkNames = (key: string, jar: Map<string, string>): string[] => {
    const names: string[] = [];
    for (let i = 0; jar.has(`${key}.${i}`); i += 1) names.push(`${key}.${i}`);
    return names;
  };

  return {
    getItem(key) {
      const jar = readAll();
      const single = jar.get(key);
      if (single !== undefined) return single;
      const chunks = chunkNames(key, jar);
      if (chunks.length === 0) return null;
      return chunks.map((n) => jar.get(n) ?? '').join('');
    },

    setItem(key, value) {
      const jar = readAll();
      // Drop any previous representation so chunked and single never coexist.
      for (const name of chunkNames(key, jar)) deleteCookie(name);

      if (encodedLength(value) <= MAX_COOKIE_VALUE_BYTES) {
        writeCookie(key, value);
        return;
      }

      deleteCookie(key);
      // Split on ENCODED length, not raw length: one character can expand to
      // several encoded bytes. Iterate by CODE POINT (Array.from), never by
      // code unit — slicing a string mid-surrogate-pair yields a lone surrogate
      // that encodeURIComponent rejects outright, corrupting the session.
      const chars = Array.from(value);
      let index = 0;
      let i = 0;
      while (i < chars.length) {
        let chunk = '';
        let size = 0;
        while (i < chars.length) {
          const next = encodedLength(chars[i]);
          // `chunk &&` guarantees forward progress even if a single character
          // somehow exceeds the whole budget.
          if (chunk && size + next > MAX_COOKIE_VALUE_BYTES) break;
          chunk += chars[i];
          size += next;
          i += 1;
        }
        writeCookie(`${key}.${index}`, chunk);
        index += 1;
      }
    },

    removeItem(key) {
      const jar = readAll();
      for (const name of chunkNames(key, jar)) deleteCookie(name);
      deleteCookie(key);
    },
  };
}

/** Structural check only — Supabase itself validates/refreshes the token. */
function looksLikeSession(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return false;
    return typeof parsed.access_token === 'string' && typeof parsed.refresh_token === 'string';
  } catch {
    return false;
  }
}

/**
 * The storage adapter handed to `createClient`.
 *
 * Reads prefer the shared cookie and fall back ONCE to the legacy
 * origin-scoped entry, promoting it into the cookie so an already-signed-in
 * user is not logged out by this change. The legacy entry is removed only after
 * the copy succeeds, and malformed data is left untouched rather than
 * destroyed — a bad migration must never cost someone their session.
 */
export function createSharedAuthStorage(opts: AuthStorageOptions): SupportedStorage {
  const cookies = cookieStorage(opts);

  return {
    getItem(key) {
      const current = cookies.getItem(key);
      if (current !== null) return current;

      const legacy = opts.legacy?.getItem(key) ?? null;
      if (legacy === null) return null;
      // Do not migrate (or delete) anything that is not a session.
      if (!looksLikeSession(legacy)) return null;

      cookies.setItem(key, legacy);
      // Only now is it safe to drop the origin-scoped copy. If the write above
      // failed, the read below returns null and the legacy entry survives for
      // the next attempt.
      if (cookies.getItem(key) !== null) opts.legacy?.removeItem(key);
      return legacy;
    },

    setItem(key, value) {
      cookies.setItem(key, value);
    },

    removeItem(key) {
      // Sign-out must clear BOTH, or a stale legacy entry would be re-migrated
      // on the next read and silently resurrect the session.
      cookies.removeItem(key);
      opts.legacy?.removeItem(key);
    },
  };
}
