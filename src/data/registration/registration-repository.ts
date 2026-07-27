import type { RegisterCompanyInput, RegisterCompanyResult, SlugAvailability } from './types';

/**
 * Registration boundary. The Register page → registration hook → this interface.
 * Mock and Edge-Function implementations are swappable; the page never calls the
 * Edge Function directly.
 */
export interface RegistrationRepository {
  register(input: RegisterCompanyInput): Promise<RegisterCompanyResult>;
  /**
   * Pre-submit slug availability. Adapters that cannot authoritatively answer
   * (no hosted lookup endpoint) return `verified: false` — the UI treats that as
   * "confirmed on submit" rather than a false positive.
   */
  checkSlugAvailability(slug: string): Promise<SlugAvailability>;
}
