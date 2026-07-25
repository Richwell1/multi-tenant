import { RepositoryError } from '@/data/errors';
import type { RegistrationRepository } from './registration-repository';
import type { RegisterCompanyInput, RegisterCompanyResult } from './types';

/**
 * Mock registration — succeeds by default. Sentinel inputs surface the same
 * distinct errors the Edge Function returns, so the UI and tests can exercise
 * each mapping without a backend:
 *   slug "taken"            -> duplicate_slug
 *   requestedSubdomain "taken" -> duplicate_subdomain
 *   email "taken@x.com"     -> duplicate_email
 */
export class MockRegistrationRepository implements RegistrationRepository {
  async register(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    await new Promise((r) => setTimeout(r, 300));

    if (input.email.toLowerCase() === 'taken@x.com') {
      throw new RepositoryError('An account with this email already exists.', 'conflict');
    }
    if (input.slug === 'taken') {
      throw new RepositoryError('That company slug is already taken.', 'conflict');
    }
    if (input.requestedSubdomain === 'taken') {
      throw new RepositoryError('That subdomain is already taken.', 'conflict');
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
