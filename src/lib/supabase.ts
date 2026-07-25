// ---------------------------------------------------------------------------
// Supabase browser client — PUBLISHABLE (anon) key only. Never the service-role
// key (that lives only in server/Edge Function environments).
//
// Created lazily so importing this module never throws when env is absent
// (e.g. in unit tests). The client is only constructed on first use, which
// happens only when the Supabase data source / auth adapter is selected.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.',
    );
  }

  client = createClient(url, publishableKey);
  return client;
}
