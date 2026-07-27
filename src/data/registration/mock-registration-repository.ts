import { RepositoryError } from '@/data/errors';
import { buildSlugCandidate, deriveSlug, isReservedSlug, slugIssue } from '@/lib/slug';
import type { RegistrationRepository } from './registration-repository';
import type { RegisterCompanyInput, RegisterCompanyResult, SlugAvailability } from './types';

/**
 * Slugs the demo backend treats as already registered — drives live availability
 * and the collision → random-suffix path without a real database. Reserved words
 * are handled separately by isReservedSlug (the canonical list in src/lib/slug).
 */
const TAKEN_SLUGS = new Set(['taken', 'acme-ltd']);

const MAX_SLUG_ATTEMPTS = 5;

const isUnavailable = (slug: string) => isReservedSlug(slug) || TAKEN_SLUGS.has(slug.toLowerCase());

/**
 * Mock registration mirrors the authoritative backend (public.register_company):
 * it OWNS the final slug. When the caller supplies a slug it is validated and
 * must be unique; otherwise a collision-safe slug is generated from the company
 * name with a bounded random-suffix retry. Sentinel inputs surface the same
 * distinct errors the Edge Function returns:
 *   email "taken@x.com"  -> duplicate_email
 *   slug  "taken"        -> duplicate_slug (chosen slug already taken)
 *   name "Acme Ltd" (x2) -> second registration gets an auto-suffixed slug
 */
export class MockRegistrationRepository implements RegistrationRepository {
  async checkSlugAvailability(slug: string): Promise<SlugAvailability> {
    await new Promise((r) => setTimeout(r, 250));
    return { slug, available: !isUnavailable(slug) && slugIssue(slug) === null, verified: true };
  }

  async register(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    await new Promise((r) => setTimeout(r, 300));

    if (input.email.toLowerCase() === 'taken@x.com') {
      throw new RepositoryError('An account with this email already exists.', 'conflict', undefined, 'email');
    }

    const finalSlug = this.allocateSlug(input);
    return {
      companyId: `mock-${finalSlug}`,
      slug: finalSlug,
      subdomain: finalSlug,
      role: 'company_admin',
      hrCore: { packageKey: 'hr-core', version: '1.0.0' },
    };
  }

  /** Backend-authoritative slug allocation (validate-or-generate + retry). */
  private allocateSlug(input: RegisterCompanyInput): string {
    const requested = input.slug?.trim().toLowerCase();
    if (requested) {
      // A user-chosen workspace URL is normalized, validated strictly, and never
      // auto-suffixed (mirrors public.register_company's requested-slug path).
      const issue = slugIssue(requested);
      if (issue === 'reserved') {
        throw new RepositoryError('This workspace URL is reserved.', 'validation', undefined, 'slug');
      }
      if (issue) {
        throw new RepositoryError('Use lowercase letters, numbers, and hyphens only.', 'validation', undefined, 'slug');
      }
      if (TAKEN_SLUGS.has(requested)) {
        throw new RepositoryError('That company slug is already taken.', 'conflict', undefined, 'slug');
      }
      return requested;
    }

    // Auto mode: derive from the name, then retry with a random suffix on collision.
    let base = deriveSlug(input.companyName);
    if (base.length < 3) base = 'company';
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = buildSlugCandidate(base, attempt);
      if (!isUnavailable(candidate) && slugIssue(candidate) === null) return candidate;
    }
    throw new RepositoryError(
      'We could not create a unique workspace URL. Please try again.',
      'unknown',
      undefined,
      'slug',
    );
  }
}
