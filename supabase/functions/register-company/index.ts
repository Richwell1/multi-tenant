// Multi-Tenants HR — register-company Edge Function
//
// Atomic company onboarding. Runs server-side with the service-role key (NEVER
// exposed to the browser). Flow:
//   validate -> normalize -> create Auth user (Admin API)
//   -> register_company RPC (authoritative, collision-safe slug allocation)
//   -> on RPC failure delete the Auth user -> respond.
//
// The slug is optional: when the founder chooses one it is validated and must be
// unique; otherwise register_company derives a unique slug from the company name
// (bounded random-suffix retry). The DATABASE owns the final slug — it is read
// back from the RPC result and returned to the client for navigation.
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
  | 'reserved_slug'
  | 'invalid_slug'
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

// Reserved slugs — mirrors public.is_reserved_slug() and src/lib/slug.ts.
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'auth', 'login', 'logout', 'register', 'dashboard', 'settings',
  'support', 'system', 'platform', 'www', 'health', 'packages', 'updates',
  'extensions', 'marketplace',
]);

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ValidData {
  companyName: string;
  email: string;
  password: string;
  /** null = auto-generate on the backend; a string = the founder's chosen slug. */
  requestedSlug: string | null;
  phone: string | null;
}

/** Explicit validator (no external deps in the Edge runtime). */
function validate(body: RegisterBody):
  | { ok: true; data: ValidData }
  | { ok: false; code: ErrCode; message: string } {
  const companyName = (body.companyName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (companyName.length < 2) return { ok: false, code: 'validation', message: 'Company name is required.' };
  if (!EMAIL_RE.test(email)) return { ok: false, code: 'validation', message: 'A valid email is required.' };
  if (password.length < 8) return { ok: false, code: 'validation', message: 'Password must be at least 8 characters.' };

  // The slug is optional. Only validate it when the founder chose one; otherwise
  // the backend derives a unique slug from the company name.
  const rawSlug = (body.slug ?? '').trim();
  let requestedSlug: string | null = null;
  if (rawSlug.length > 0) {
    const slug = normalizeSlug(rawSlug);
    if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 63) {
      return { ok: false, code: 'invalid_slug', message: 'Use lowercase letters, numbers, and hyphens only.' };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { ok: false, code: 'reserved_slug', message: 'This workspace URL is reserved.' };
    }
    requestedSlug = slug;
  }

  return { ok: true, data: { companyName, email, password, requestedSlug, phone: body.phone?.trim() || null } };
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
  if (!result.ok) return fail(400, result.code, result.message);
  const { companyName, email, password, requestedSlug, phone } = result.data;

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

  // 2) Authoritative, collision-safe tenant onboarding. The backend owns the
  //    final slug and returns it in `data.slug`.
  const { data, error } = await admin.rpc('register_company', {
    p_user_id: userId,
    p_company_name: companyName,
    p_requested_slug: requestedSlug,
    p_company_email: email,
    p_phone: phone,
  });

  if (error) {
    // 3) Roll back the orphaned Auth user so no partial account survives.
    await admin.auth.admin.deleteUser(userId);
    const m = error.message ?? '';
    if (m.includes('reserved_slug')) return fail(400, 'reserved_slug', 'This workspace URL is reserved.');
    if (m.includes('duplicate_slug')) return fail(409, 'duplicate_slug', 'This workspace URL is already taken.');
    if (m.includes('duplicate_subdomain')) return fail(409, 'duplicate_subdomain', 'That subdomain is already taken.');
    if (m.includes('user_already_member')) return fail(409, 'conflict', 'This account already belongs to a company.');
    if (m.includes('slug_allocation_failed'))
      return fail(503, 'onboarding_failed', 'We could not create a unique workspace URL. Please try again.');
    if (m.includes('invalid_slug')) return fail(400, 'invalid_slug', 'Use lowercase letters, numbers, and hyphens only.');
    if (m.startsWith('invalid_')) return fail(400, 'validation', 'The submitted company details are invalid.');
    console.error('register_company failed');
    return fail(500, 'onboarding_failed', 'Registration could not be completed. Please try again.');
  }

  // The DB is authoritative: the client navigates using data.slug, never a
  // slug re-derived from the company name.
  return json(201, { data });
});
