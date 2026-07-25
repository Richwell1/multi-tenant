// ---------------------------------------------------------------------------
// Supabase auth adapter. Uses the publishable-key browser client only. Provides
// real session restoration (Supabase persists to storage) and auth-state events.
// Not active until the auth factory selects 'supabase'.
// ---------------------------------------------------------------------------

import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { AuthRepository } from './auth-repository';
import type { AuthSession, SignInInput, Unsubscribe } from './types';

interface SupabaseUserLike {
  id: string;
  email?: string | null;
}

function toSession(user: SupabaseUserLike | null | undefined): AuthSession | null {
  if (!user) return null;
  return { user: { id: user.id, email: user.email ?? '' } };
}

export class SupabaseAuthRepository implements AuthRepository {
  async signIn({ email, password }: SignInInput): Promise<AuthSession> {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw mapSupabaseError(error);
    const session = toSession(data.user);
    if (!session) throw mapSupabaseError({ message: 'Sign-in returned no user', status: 401 });
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw mapSupabaseError(error);
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw mapSupabaseError(error);
    return toSession(data.session?.user);
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): Unsubscribe {
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      callback(toSession(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }
}
