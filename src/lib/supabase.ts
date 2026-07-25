// ---------------------------------------------------------------------------
// Supabase browser client. Uses the PUBLISHABLE (anon) key only — safe for the
// browser. The service-role key must never appear in frontend code.
//
// This client is intentionally NOT wired into the app yet. When the backend
// phase begins, a Supabase implementation of the `Repository` interface
// (src/data/repository.types.ts) will consume this client, so pages/hooks stay
// unchanged. Fail-fast validation keeps misconfiguration loud at the boundary.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.',
  );
}

export const supabase = createClient(url, publishableKey);
