// ---------------------------------------------------------------------------
// Public login page behaviour on the marketing host.
//
// The generic login must be usable by someone who does not know their
// subdomain, must never be shown to an already-authenticated visitor, and must
// never let a `?tenant=` hint decide which workspace opens.
// ---------------------------------------------------------------------------
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => navigate,
}));

const queryClientClear = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: queryClientClear }),
}));

const signIn = vi.fn();
const logout = vi.fn();
const session = {
  signIn,
  logout,
  authenticated: false,
  authLoading: false,
  user: null as { id: string } | null,
};
vi.mock('@/lib/session', () => ({ useSession: () => session }));
vi.mock('@/hooks/use-login-portal-context', () => ({
  useLoginPortalContext: () => ({ type: 'company', companyName: 'Company Workspace' }),
}));

const isPlatformAdmin = vi.fn();
const getCompanyContext = vi.fn();
vi.mock('@/data/context', () => ({
  platformAdminRepository: { isPlatformAdmin: (u: unknown) => isPlatformAdmin(u) },
  companyContextRepository: { getCompanyContext: (u: unknown) => getCompanyContext(u) },
}));

import { LoginPage } from './public';

const MARKETING = 'home.merbsconnect.com';

function setLocation(hostname: string, search = '') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname, search, href: `https://${hostname}/login${search}`, replace: vi.fn() },
  });
}

function signInAs(user = { id: 'u1' }) {
  signIn.mockResolvedValue({ user });
}

function submit(email = 'james@hr.com') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('public login on the marketing host', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.authenticated = false;
    session.authLoading = false;
    session.user = null;
    setLocation(MARKETING);
    isPlatformAdmin.mockResolvedValue(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the generic company login with no tenant parameter', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('signs in without a tenant parameter and opens the resolved workspace', async () => {
    signInAs();
    getCompanyContext.mockResolvedValue({ companySlug: 'james', companyName: 'James HR' });

    render(<LoginPage />);
    submit();

    await waitFor(() => expect(window.location.href).toBe('https://james.merbsconnect.com/dashboard'));
    // Lacking ?tenant= must never be an error.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it('clears cached tenant data before crossing hosts', async () => {
    signInAs();
    getCompanyContext.mockResolvedValue({ companySlug: 'james', companyName: 'James HR' });

    render(<LoginPage />);
    submit();

    await waitFor(() => expect(queryClientClear).toHaveBeenCalled());
  });

  it('accepts a matching tenant hint', async () => {
    setLocation(MARKETING, '?tenant=james');
    signInAs();
    getCompanyContext.mockResolvedValue({ companySlug: 'james', companyName: 'James HR' });

    render(<LoginPage />);
    submit();

    await waitFor(() => expect(window.location.href).toBe('https://james.merbsconnect.com/dashboard'));
  });

  it('ignores a WRONG tenant hint and opens the account’s own workspace', async () => {
    // ?tenant=kimhr, but the account belongs to james.
    setLocation(MARKETING, '?tenant=kimhr');
    signInAs();
    getCompanyContext.mockResolvedValue({ companySlug: 'james', companyName: 'James HR' });

    render(<LoginPage />);
    submit();

    await waitFor(() => expect(window.location.href).toBe('https://james.merbsconnect.com/dashboard'));
    // Not treated as a failure, and the session survives.
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejects an account with no active membership', async () => {
    signInAs();
    getCompanyContext.mockResolvedValue(null);

    render(<LoginPage />);
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no active company workspace/i);
    expect(logout).toHaveBeenCalled();
  });

  it('does not send a platform admin into a company workspace', async () => {
    signInAs();
    isPlatformAdmin.mockResolvedValue(true);

    render(<LoginPage />);
    submit();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(logout).toHaveBeenCalled();
    expect(window.location.href).not.toContain('/dashboard');
  });
});

describe('already-authenticated visitor on public login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.authenticated = true;
    session.authLoading = false;
    session.user = { id: 'u1' };
    setLocation(MARKETING);
    isPlatformAdmin.mockResolvedValue(false);
  });

  it('redirects to the company dashboard instead of showing the form', async () => {
    getCompanyContext.mockResolvedValue({ companySlug: 'james', companyName: 'James HR' });

    render(<LoginPage />);

    await waitFor(() => expect(window.location.href).toBe('https://james.merbsconnect.com/dashboard'));
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('sends a restored platform admin to the console, not a workspace', async () => {
    isPlatformAdmin.mockResolvedValue(true);

    render(<LoginPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/admin' }));
    expect(getCompanyContext).not.toHaveBeenCalled();
  });

  it('falls back to the form when authenticated with no membership', async () => {
    getCompanyContext.mockResolvedValue(null);

    render(<LoginPage />);

    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
  });

  it('shows a waiting state rather than the form while auth is still loading', () => {
    session.authLoading = true;
    render(<LoginPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
