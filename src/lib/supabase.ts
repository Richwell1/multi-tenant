// ---------------------------------------------------------------------------
// Supabase browser client — PUBLISHABLE (anon) key only. Never the service-role
// key (that lives only in server/Edge Function environments).
//
// Created lazily so importing this module never throws when env is absent
// (e.g. in unit tests). The client is only constructed on first use, which
// happens only when the Supabase data source / auth adapter is selected.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSharedAuthStorage } from './auth-storage';
import { appBaseDomain } from './tenant';

let client: SupabaseClient | null = null;

/**
 * Session storage shared across the app's subdomains (see auth-storage.ts).
 * Returns undefined outside a browser so Supabase keeps its own default.
 *
 * The storage KEY is deliberately left to Supabase: it derives
 * `sb-<projectRef>-auth-token` from the project URL, which is identical on
 * every host. Overriding it per host would re-isolate the very sessions this
 * exists to share.
 */
function sharedAuthStorage() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
  return createSharedAuthStorage({
    hostname: window.location.hostname,
    baseDomain: appBaseDomain(),
    secure: window.location.protocol === 'https:',
    cookies: {
      read: () => document.cookie,
      write: (serialized) => {
        document.cookie = serialized;
      },
    },
    // Migrate anyone already signed in via the previous origin-scoped store.
    legacy: (() => {
      try {
        return window.localStorage;
      } catch {
        // Storage can throw when blocked by browser settings.
        return null;
      }
    })(),
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.',
    );
  }

  const storage = sharedAuthStorage();
  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // A refreshed token written on any host is visible to all of them.
      ...(storage ? { storage } : {}),
    },
  });
  return client;
}
