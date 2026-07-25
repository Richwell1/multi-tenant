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
import { getCompany, resolveContext, type ResolvedContext } from './tenant';

interface SessionState {
  portal: Portal;
  tenantId: string | null;
  company: Company | undefined;
  authenticated: boolean;
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

  // Restore any existing session on load and stay in sync with auth changes.
  useEffect(() => {
    let active = true;
    authRepository.getSession().then((s) => {
      if (active) setSession(s);
    });
    const unsubscribe = authRepository.onAuthStateChange((s) => setSession(s));
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
    await authRepository.signOut();
    setSession(null);
    // Clear cached tenant-scoped data so nothing leaks between sessions.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<SessionState>(
    () => ({
      portal: ctx.portal,
      tenantId: ctx.tenantId,
      company: getCompany(ctx.tenantId),
      authenticated: !!session,
      email: session?.user.email ?? null,
      signIn,
      logout,
    }),
    [ctx, session, signIn, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
