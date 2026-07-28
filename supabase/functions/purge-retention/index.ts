// Multi-Tenants HR — purge-retention Edge Function
//
// Secure, scheduled purge of package feature data whose 30-day retention window
// has expired. Runs server-side with the service-role key (NEVER exposed to the
// browser) and delegates to the idempotent public.purge_expired_retention() RPC,
// which locks each company+package row, deletes only that package's company data,
// records COUNTS (not content) in the audit log, and isolates failures per tenant.
//
// Invoke on a schedule (e.g. a daily Vercel/Supabase cron) or manually by a
// trusted operator. It takes no request body and returns a JSON summary.
//
// Authorization: the caller MUST present the service-role key (or a dedicated
// PURGE_SECRET, if set) as a Bearer token. Browser clients hold only the
// publishable/anon key or a user JWT and are rejected. Deploy with
// `--no-verify-jwt` so a non-JWT PURGE_SECRET is supported; this function
// enforces its own authorization.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Constant-time string comparison (avoids timing side-channels on the secret). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: { code: 'method_not_allowed', message: 'Use POST.' } });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: { code: 'server_error', message: 'Server is not configured.' } });

  // Authorization: only a TRUSTED caller (scheduled cron / operator) holding the
  // service-role key may trigger a purge. A dedicated PURGE_SECRET is preferred
  // when set; otherwise the service-role key is accepted. Browser clients hold
  // the publishable/anon key or a user JWT and are rejected here. Constant-time
  // compare avoids leaking the secret via timing.
  const expected = Deno.env.get('PURGE_SECRET') ?? serviceRoleKey;
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json(401, { error: { code: 'unauthorized', message: 'Not authorized.' } });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await admin.rpc('purge_expired_retention');
  if (error) {
    console.error('purge_expired_retention failed');
    return json(500, { error: { code: 'purge_failed', message: 'The retention purge could not complete.' } });
  }
  // data => { purged_packages, rows_deleted }
  return json(200, { data });
});
