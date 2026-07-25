// ---------------------------------------------------------------------------
// Mock auth adapter — preserves the demo's existing behavior: any credentials
// succeed EXCEPT the sentinel password "wrong", which surfaces an invalid-
// credentials error. Session is in-memory (no persistence), matching today's UX.
// ---------------------------------------------------------------------------

import { RepositoryError } from '@/data/errors';
import type { AuthRepository } from './auth-repository';
import type { AuthSession, SignInInput, Unsubscribe } from './types';

function idFromEmail(email: string): string {
  return `mock-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export class MockAuthRepository implements AuthRepository {
  private session: AuthSession | null = null;
  private listeners = new Set<(session: AuthSession | null) => void>();

  private emit() {
    for (const cb of this.listeners) cb(this.session);
  }

  async signIn({ email, password }: SignInInput): Promise<AuthSession> {
    await new Promise((r) => setTimeout(r, 200));
    if (password === 'wrong') {
      throw new RepositoryError('Invalid email or password. Please try again.', 'forbidden');
    }
    this.session = { user: { id: idFromEmail(email), email } };
    this.emit();
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
    this.emit();
  }

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}
