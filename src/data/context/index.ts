// ---------------------------------------------------------------------------
// Context factories — mock by default; Supabase adapters loaded lazily (SDK out
// of the default bundle) via VITE_DATA_SOURCE=supabase.
// ---------------------------------------------------------------------------

import { resolveDataSource } from '@/data/repository';
import type { AuthUser } from '@/data/auth';
import type {
  CompanyContextRepository,
  MembershipRepository,
  PlatformAdminRepository,
} from './repositories';
import {
  MockCompanyContextRepository,
  MockMembershipRepository,
  MockPlatformAdminRepository,
} from './mock';
import type { CompanyBySlug, CompanySessionContext, MembershipRecord } from './types';

class LazyPlatformAdminRepository implements PlatformAdminRepository {
  isPlatformAdmin(user: AuthUser): Promise<boolean> {
    return import('./supabase').then((m) => new m.SupabasePlatformAdminRepository().isPlatformAdmin(user));
  }
}
class LazyMembershipRepository implements MembershipRepository {
  getActiveMembership(user: AuthUser): Promise<MembershipRecord | null> {
    return import('./supabase').then((m) => new m.SupabaseMembershipRepository().getActiveMembership(user));
  }
}
class LazyCompanyContextRepository implements CompanyContextRepository {
  getCompanyContext(user: AuthUser): Promise<CompanySessionContext | null> {
    return import('./supabase').then((m) => new m.SupabaseCompanyContextRepository().getCompanyContext(user));
  }
  findCompanyBySlug(slug: string): Promise<CompanyBySlug | null> {
    return import('./supabase').then((m) => new m.SupabaseCompanyContextRepository().findCompanyBySlug(slug));
  }
}

export function createPlatformAdminRepository(source = resolveDataSource()): PlatformAdminRepository {
  return source === 'supabase' ? new LazyPlatformAdminRepository() : new MockPlatformAdminRepository();
}
export function createMembershipRepository(source = resolveDataSource()): MembershipRepository {
  return source === 'supabase' ? new LazyMembershipRepository() : new MockMembershipRepository();
}
export function createCompanyContextRepository(source = resolveDataSource()): CompanyContextRepository {
  return source === 'supabase' ? new LazyCompanyContextRepository() : new MockCompanyContextRepository();
}

export const platformAdminRepository = createPlatformAdminRepository();
export const membershipRepository = createMembershipRepository();
export const companyContextRepository = createCompanyContextRepository();

export type {
  PlatformAdminRepository,
  MembershipRepository,
  CompanyContextRepository,
} from './repositories';
export type { CompanyBySlug, CompanySessionContext, MembershipRecord } from './types';
