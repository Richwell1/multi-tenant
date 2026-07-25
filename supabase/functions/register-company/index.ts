// Multi-Tenants HR — register-company Edge Function
//
// Atomic company onboarding. Runs server-side with the service-role key (NEVER
// exposed to the browser). Flow:
//   validate -> normalize -> create Auth user (Admin API)
//   -> onboard_company RPC -> on RPC failure delete the Auth user -> respond.
//
// Email/password only. No MFA / OTP / invitations / password reset.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RegisterBody {
  companyName?: string;
  slug?: string;
  requestedSubdomain?: string;
  adminName?: string;
  email?: string;
  password?: string;
  phone?: string;
}

type ErrCode =
  | 'validation'
  | 'duplicate_email'
  | 'duplicate_slug'
  | 'duplicate_subdomain'
  | 'conflict'
  | 'onboarding_failed'
  | 'server_error';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, code: ErrCode, message: string) {
  return json(status, { error: { code, message } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Explicit validator (no external deps in the Edge runtime). */
function validate(body: RegisterBody): { ok: true; data: Required<Pick<RegisterBody, 'companyName' | 'email' | 'password'>> & { slug: string; subdomain: string; phone: string | null } } | { ok: false; message: string } {
  const companyName = (body.companyName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const rawSlug = body.slug ?? body.requestedSubdomain ?? '';
  const slug = normalizeSlug(rawSlug);
  const subdomain = normalizeSlug(body.requestedSubdomain ?? rawSlug);

  if (companyName.length < 2) return { ok: false, message: 'Company name is required.' };
  if (!EMAIL_RE.test(email)) return { ok: false, message: 'A valid email is required.' };
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };
  if (!SLUG_RE.test(slug)) return { ok: false, message: 'Company slug is invalid.' };
  if (!SLUG_RE.test(subdomain)) return { ok: false, message: 'Subdomain is invalid.' };

  return { ok: true, data: { companyName, email, password, slug, subdomain, phone: body.phone?.trim() || null } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail(405, 'validation', 'Method not allowed.');

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return fail(500, 'server_error', 'Server is not configured.');

  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'validation', 'Invalid JSON body.');
  }

  const result = validate(body);
  if (!result.ok) return fail(400, 'validation', result.message);
  const { companyName, email, password, slug, subdomain, phone } = result.data;

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Create the Auth user (email confirmed so the founder can sign in locally).
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: body.adminName ?? null },
  });
  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? '';
    if (/already|registered|exists/i.test(msg)) {
      return fail(409, 'duplicate_email', 'An account with this email already exists.');
    }
    console.error('createUser failed:', created.error?.status);
    return fail(400, 'validation', 'Could not create the account.');
  }
  const userId = created.data.user.id;

  // 2) Atomic tenant onboarding.
  const { data, error } = await admin.rpc('onboard_company', {
    p_user_id: userId,
    p_company_name: companyName,
    p_slug: slug,
    p_subdomain: subdomain,
    p_company_email: email,
    p_phone: phone,
  });

  if (error) {
    // 3) Roll back the orphaned Auth user so no partial account survives.
    await admin.auth.admin.deleteUser(userId);
    const m = error.message ?? '';
    if (m.includes('duplicate_slug')) return fail(409, 'duplicate_slug', 'That company slug is already taken.');
    if (m.includes('duplicate_subdomain')) return fail(409, 'duplicate_subdomain', 'That subdomain is already taken.');
    if (m.includes('user_already_member')) return fail(409, 'conflict', 'This account already belongs to a company.');
    if (m.startsWith('invalid_')) return fail(400, 'validation', 'The submitted company details are invalid.');
    console.error('onboard_company failed');
    return fail(500, 'onboarding_failed', 'Registration could not be completed. Please try again.');
  }

  return json(201, { data });
});
