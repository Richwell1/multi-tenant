import { describe, it, expect, vi } from 'vitest';
import { MockAuthRepository } from './mock-auth-repository';
import { RepositoryError } from '@/data/errors';

describe('MockAuthRepository', () => {
  it('signs in with any credentials and returns a session', async () => {
    const auth = new MockAuthRepository();
    const session = await auth.signIn({ email: 'admin@alpha.com', password: 'anything' });
    expect(session.user.email).toBe('admin@alpha.com');
    expect(session.user.id).toMatch(/^mock-/);
  });

  it('rejects the sentinel "wrong" password as invalid credentials', async () => {
    const auth = new MockAuthRepository();
    await expect(auth.signIn({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });

  it('restores no session before sign-in, and the session after', async () => {
    const auth = new MockAuthRepository();
    expect(await auth.getSession()).toBeNull();
    await auth.signIn({ email: 'a@b.com', password: 'x' });
    expect(await auth.getSession()).not.toBeNull();
  });

  it('signOut clears the session', async () => {
    const auth = new MockAuthRepository();
    await auth.signIn({ email: 'a@b.com', password: 'x' });
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
  });

  it('notifies subscribers on sign-in/out and stops after unsubscribe', async () => {
    const auth = new MockAuthRepository();
    const cb = vi.fn();
    const unsub = auth.onAuthStateChange(cb);
    await auth.signIn({ email: 'a@b.com', password: 'x' });
    await auth.signOut();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    await auth.signIn({ email: 'a@b.com', password: 'x' });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
