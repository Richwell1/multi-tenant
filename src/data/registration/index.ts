// ---------------------------------------------------------------------------
// Registration factory — mock by default; Edge Function adapter when the data
// source is Supabase (same VITE_DATA_SOURCE switch as auth/data).
// ---------------------------------------------------------------------------

import { resolveDataSource } from '@/data/repository';
import { MockRegistrationRepository } from './mock-registration-repository';
import { EdgeRegistrationRepository } from './edge-registration-repository';
import type { RegistrationRepository } from './registration-repository';

export function createRegistrationRepository(source = resolveDataSource()): RegistrationRepository {
  return source === 'supabase' ? new EdgeRegistrationRepository() : new MockRegistrationRepository();
}

export const registrationRepository: RegistrationRepository = createRegistrationRepository();

export type { RegistrationRepository } from './registration-repository';
export type { RegisterCompanyInput, RegisterCompanyResult } from './types';
