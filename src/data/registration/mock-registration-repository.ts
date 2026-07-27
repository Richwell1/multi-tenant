import { RepositoryError } from '@/data/errors';
import type { RegistrationRepository } from './registration-repository';
import type { RegisterCompanyInput, RegisterCompanyResult, SlugAvailability } from './types';

/** Slugs the demo backend treats as already taken (drives live availability). */
const RESERVED_SLUGS = new Set(['taken', 'admin', 'www', 'app']);

/**
 * Mock registration — succeeds by default. Sentinel inputs surface the same
 * distinct errors the Edge Function returns, so the UI and tests can exercise
 * each mapping without a backend:
 *   slug "taken"            -> duplicate_slug
 *   requestedSubdomain "taken" -> duplicate_subdomain
 *   email "taken@x.com"     -> duplicate_email
 */
export class MockRegistrationRepository implements RegistrationRepository {
  async checkSlugAvailability(slug: string): Promise<SlugAvailability> {
    await new Promise((r) => setTimeout(r, 250));
    return { slug, available: !RESERVED_SLUGS.has(slug.toLowerCase()), verified: true };
  }

  async register(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    await new Promise((r) => setTimeout(r, 300));

    if (input.email.toLowerCase() === 'taken@x.com') {
      throw new RepositoryError('An account with this email already exists.', 'conflict', undefined, 'email');
    }
    if (RESERVED_SLUGS.has(input.slug.toLowerCase())) {
      throw new RepositoryError('That company slug is already taken.', 'conflict', undefined, 'slug');
    }
    if (input.requestedSubdomain === 'taken') {
      throw new RepositoryError('That subdomain is already taken.', 'conflict', undefined, 'subdomain');
    }

    const subdomain = input.requestedSubdomain?.trim() || input.slug;
    return {
      companyId: `mock-${input.slug}`,
      slug: input.slug,
      subdomain,
      role: 'company_admin',
      hrCore: { packageKey: 'hr-core', version: '1.0.0' },
    };
  }
}
