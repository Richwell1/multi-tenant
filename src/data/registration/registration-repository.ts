import type { RegisterCompanyInput, RegisterCompanyResult } from './types';

/**
 * Registration boundary. The Register page → registration hook → this interface.
 * Mock and Edge-Function implementations are swappable; the page never calls the
 * Edge Function directly.
 */
export interface RegistrationRepository {
  register(input: RegisterCompanyInput): Promise<RegisterCompanyResult>;
}
