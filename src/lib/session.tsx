import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Company, Portal } from '@/data/types';
import { getCompany, resolveContext, type ResolvedContext } from './tenant';

interface SessionState {
  portal: Portal;
  tenantId: string | null;
  company: Company | undefined;
  authenticated: boolean;
  email: string | null;
  login: (email: string) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Resolve portal/tenant ONCE at load. It is determined by the hostname (or the
  // ?portal=/?tenant= dev override) and must stay stable across client-side
  // navigation — otherwise moving to /dashboard (no query param) would reset it.
  const [ctx] = useState<ResolvedContext>(() =>
    typeof window !== 'undefined'
      ? resolveContext(window.location.hostname, window.location.search)
      : { portal: 'admin', tenantId: null },
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const login = useCallback((value: string) => {
    setEmail(value);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setEmail(null);
    setAuthenticated(false);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      portal: ctx.portal,
      tenantId: ctx.tenantId,
      company: getCompany(ctx.tenantId),
      authenticated,
      email,
      login,
      logout,
    }),
    [ctx, authenticated, email, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
