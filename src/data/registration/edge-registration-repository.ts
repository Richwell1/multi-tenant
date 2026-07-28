import { RepositoryError, type RepositoryErrorKind } from '@/data/errors';
import type { RegistrationRepository } from './registration-repository';
import type { RegisterCompanyInput, RegisterCompanyResult, SlugAvailability } from './types';

interface EdgeErrorBody {
  error?: { code?: string; message?: string };
}
interface EdgeSuccessBody {
  data?: {
    company_id: string;
    slug: string;
    subdomain: string;
    role: 'company_admin';
    hr_core: { package_key: string; version: string };
  };
}

/** The form field an Edge Function conflict code maps to (for inline errors). */
function conflictField(code: string | undefined): 'slug' | 'subdomain' | 'email' | undefined {
  if (code === 'duplicate_slug' || code === 'reserved_slug' || code === 'invalid_slug') return 'slug';
  if (code === 'duplicate_subdomain') return 'subdomain';
  if (code === 'duplicate_email') return 'email';
  return undefined;
}

/**
 * Our own copy for each backend reason.
 *
 * The Edge Function's `message` is deliberately NOT shown to users. It is
 * server-authored text that has drifted from this client before: a deployed
 * build answered a MISSING slug with "Company slug is invalid.", which surfaced
 * verbatim and told people their perfectly valid slug was malformed. Mapping
 * the CODE — the part that is a contract — keeps the wording ours and keeps a
 * stale backend from inventing user-facing copy.
 */
const REGISTRATION_MESSAGE: Record<string, string> = {
  invalid_slug: 'Use lowercase letters, numbers, and hyphens only.',
  reserved_slug: 'This workspace URL is reserved. Choose another name.',
  duplicate_slug: 'This workspace URL is already taken.',
  duplicate_subdomain: 'This workspace URL is already taken.',
  duplicate_email: 'An account already exists for this email.',
  conflict: 'Those details are already in use.',
  validation: 'Please check the highlighted fields and try again.',
  onboarding_failed: 'Registration is temporarily unavailable. Please try again.',
  server_error: 'Registration is temporarily unavailable. Please try again.',
};

/** Pure mapping of an Edge Function error response → RepositoryError. */
export function mapRegistrationError(code: string | undefined, message: string | undefined): RepositoryError {
  const conflictCodes = ['duplicate_email', 'duplicate_slug', 'duplicate_subdomain', 'conflict'];
  const validationCodes = ['validation', 'reserved_slug', 'invalid_slug'];
  const kind: RepositoryErrorKind = conflictCodes.includes(code ?? '')
    ? 'conflict'
    : validationCodes.includes(code ?? '')
      ? 'validation'
      : 'unknown';
  // Fall back to the server's text only for a code we have never heard of, so a
  // genuinely new backend reason is not silently swallowed.
  const safeMessage =
    REGISTRATION_MESSAGE[code ?? ''] ?? message ?? 'Registration could not be completed. Please try again.';
  return new RepositoryError(safeMessage, kind, undefined, conflictField(code));
}

/**
 * Calls the register-company Edge Function with the publishable/anon key only.
 * The service-role key never appears here (it lives inside the Edge Function).
 */
export class EdgeRegistrationRepository implements RegistrationRepository {
  /**
   * Pre-submit availability via the public.is_slug_available RPC (boolean only —
   * never returns company rows). Uses the anon key through PostgREST. On any
   * transport failure we degrade to best-effort (available, unverified) so the UI
   * never shows a false "taken"; the database is still authoritative at submit.
   */
  async checkSlugAvailability(slug: string): Promise<SlugAvailability> {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(`${baseUrl}/rest/v1/rpc/is_slug_available`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ p_slug: slug }),
      });
      if (!res.ok) return { slug, available: true, verified: false };
      const available = (await res.json()) as boolean;
      return { slug, available: available === true, verified: true };
    } catch {
      return { slug, available: true, verified: false };
    }
  }

  async register(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/functions/v1/register-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify(input),
      });
    } catch (cause) {
      throw new RepositoryError('Network error. Please try again.', 'network', cause);
    }

    const body = (await res.json().catch(() => ({}))) as EdgeErrorBody & EdgeSuccessBody;

    if (!res.ok || !body.data) {
      throw mapRegistrationError(body.error?.code, body.error?.message);
    }

    const d = body.data;
    return {
      companyId: d.company_id,
      slug: d.slug,
      subdomain: d.subdomain,
      role: d.role,
      hrCore: { packageKey: d.hr_core.package_key, version: d.hr_core.version },
    };
  }
}
