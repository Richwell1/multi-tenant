import { RepositoryError, type RepositoryErrorKind } from '@/data/errors';
import type { RegistrationRepository } from './registration-repository';
import type { RegisterCompanyInput, RegisterCompanyResult } from './types';

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

/** Pure mapping of an Edge Function error response → RepositoryError. */
export function mapRegistrationError(code: string | undefined, message: string | undefined): RepositoryError {
  const kind: RepositoryErrorKind =
    code === 'duplicate_email' || code === 'duplicate_slug' || code === 'duplicate_subdomain' || code === 'conflict'
      ? 'conflict'
      : code === 'validation'
        ? 'validation'
        : 'unknown';
  return new RepositoryError(message ?? 'Registration failed. Please try again.', kind);
}

/**
 * Calls the register-company Edge Function with the publishable/anon key only.
 * The service-role key never appears here (it lives inside the Edge Function).
 */
export class EdgeRegistrationRepository implements RegistrationRepository {
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
