import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Company, Portal } from '@/data/types';
import { authRepository } from '@/data/auth';
import type { AuthSession, SignInInput } from '@/data/auth';
import { notify } from './notify';
import { getCompany, resolveContext, type ResolvedContext } from './tenant';

interface SessionState {
  portal: Portal;
  tenantId: string | null;
  company: Company | undefined;
  authenticated: boolean;
  /** True while the session is being restored on load (guards should wait). */
  authLoading: boolean;
  user: AuthSession['user'] | null;
  email: string | null;
  /** Sign in via the auth boundary (mock or Supabase). */
  signIn: (input: SignInInput) => Promise<AuthSession>;
  /** Sign out and clear all cached tenant data. */
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Resolve portal/tenant ONCE at load — determined by hostname (or the
  // ?portal=/?tenant= dev override) and stable across client-side navigation.
  const [ctx] = useState<ResolvedContext>(() =>
    typeof window !== 'undefined'
      ? resolveContext(window.location.hostname, window.location.search)
      : { portal: 'admin', tenantId: null },
  );
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore any existing session on load and stay in sync with auth changes.
  useEffect(() => {
    let active = true;
    authRepository
      .getSession()
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(() => {
        // A failed restore must release guards; otherwise a transient auth
        // error leaves the application on an infinite loading screen.
        if (active) {
          setSession(null);
          notify.networkFailure('Your session could not be restored. Please sign in again.');
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    const unsubscribe = authRepository.onAuthStateChange((s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const s = await authRepository.signIn(input);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    let signOutFailed = false;
    try {
      await authRepository.signOut();
    } catch {
      signOutFailed = true;
    }
    setSession(null);
    // Clear cached tenant-scoped data so nothing leaks between sessions.
    queryClient.clear();
    if (signOutFailed) notify.networkFailure('Sign out could not be confirmed. Local data was cleared.');
  }, [queryClient]);

  const value = useMemo<SessionState>(
    () => ({
      portal: ctx.portal,
      tenantId: ctx.tenantId,
      company: getCompany(ctx.tenantId),
      authenticated: !!session,
      authLoading,
      user: session?.user ?? null,
      email: session?.user.email ?? null,
      signIn,
      logout,
    }),
    [ctx, session, authLoading, signIn, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
