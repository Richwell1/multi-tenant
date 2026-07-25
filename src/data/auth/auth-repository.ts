// ---------------------------------------------------------------------------
// Auth boundary (dependency inversion). The login page → auth hook → this
// interface. Mock and Supabase implementations are swappable without touching
// the UI.
// ---------------------------------------------------------------------------

import type { AuthSession, SignInInput, Unsubscribe } from './types';

export interface AuthRepository {
  /** Sign in with email + password. Rejects (RepositoryError) on bad credentials. */
  signIn(input: SignInInput): Promise<AuthSession>;
  /** Sign out and clear the session. */
  signOut(): Promise<void>;
  /** Current session (used for restoration on load); null when signed out. */
  getSession(): Promise<AuthSession | null>;
  /** Subscribe to session changes; returns an unsubscribe handle. */
  onAuthStateChange(callback: (session: AuthSession | null) => void): Unsubscribe;
}
