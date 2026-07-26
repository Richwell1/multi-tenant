// ---------------------------------------------------------------------------
// Auth factory — selects the auth adapter. Defaults to mock; opts into Supabase
// via VITE_DATA_SOURCE=supabase (same switch as the data repository).
//
// The Supabase adapter (and the ~200 KB SDK it pulls in) is loaded via dynamic
// import ONLY when Supabase is selected, so the default/mock bundle stays lean.
// ---------------------------------------------------------------------------

import { resolveDataSource } from '@/data/repository';
import { MockAuthRepository } from './mock-auth-repository';
import type { AuthRepository } from './auth-repository';
import type { AuthSession, SignInInput, Unsubscribe } from './types';

/**
 * Defers loading the Supabase auth adapter (and SDK) until first use, keeping it
 * out of the initial bundle. Kept internal — consumers just see AuthRepository.
 */
class LazySupabaseAuthRepository implements AuthRepository {
  private realP: Promise<AuthRepository> | null = null;

  private real = (): Promise<AuthRepository> => {
    this.realP ??= import('./supabase-auth-repository').then((m) => new m.SupabaseAuthRepository());
    return this.realP;
  };

  signIn = (input: SignInInput): Promise<AuthSession> => this.real().then((r) => r.signIn(input));

  signOut = (): Promise<void> => this.real().then((r) => r.signOut());

  getSession = (): Promise<AuthSession | null> => this.real().then((r) => r.getSession());

  onAuthStateChange = (callback: (session: AuthSession | null) => void): Unsubscribe => {
    let unsubscribe: Unsubscribe = () => {};
    let cancelled = false;
    this.real().then((r) => {
      if (!cancelled) unsubscribe = r.onAuthStateChange(callback);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  };
}

export function createAuthRepository(source = resolveDataSource()): AuthRepository {
  return source === 'supabase' ? new LazySupabaseAuthRepository() : new MockAuthRepository();
}

/** Default auth repository consumed by the session provider. */
export const authRepository: AuthRepository = createAuthRepository();

export type { AuthRepository } from './auth-repository';
export type { AuthSession, SignInInput, AuthUser } from './types';
