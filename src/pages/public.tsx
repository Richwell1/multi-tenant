import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Building2, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccessDeniedState, CompanySuspendedState } from '@/components/states';
import { useSession } from '@/lib/session';
import { useLoginPortalContext } from '@/hooks/use-login-portal-context';
import { useRegisterCompany, useSlugAvailability } from '@/hooks/use-register-company';
import type { RegisterCompanyResult } from '@/data/registration';
import { deriveSlug, slugIssue, SLUG_MIN_LENGTH, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@/lib/slug';
import { workspaceHost } from '@/lib/app-config';
import { appBaseDomain, registrationHandoffUrl, resolveWorkspaceDestination } from '@/lib/tenant';
import { resolveLoginDestination } from '@/lib/login-destination';
import { passwordStrength, PASSWORD_STRENGTH_LABEL, type PasswordStrength } from '@/lib/password';
import { RepositoryError } from '@/data/errors';
import { companyContextRepository, platformAdminRepository } from '@/data/context';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { AppVersion } from '@/components/app-version';

// --- Auth: email + password only (no reset, MFA, invitations, social) ---------

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

function AuthLayout({ children, portalClass }: { children: React.ReactNode; portalClass: string }) {
  return (
    <div className={cn('min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8', portalClass)}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <div className="hidden flex-col justify-center rounded-2xl border border-border bg-surface-subtle p-10 lg:flex">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--portal-color)] text-lg font-bold text-white shadow-sm">
                M
              </div>
              <div>
                <p className="text-sm font-semibold text-content">Multi-Tenants HR</p>
                <p className="text-xs text-content-variant">Secure workspace operations</p>
              </div>
            </div>
            <p className="text-label-bold uppercase tracking-[0.14em] text-[var(--portal-color)]">One shared platform</p>
            <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight text-content xl:text-5xl">
              Your team’s HR workspace, ready when you are.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-content-variant">
              Sign in once with your work email and continue to the company workspace your account belongs to.
            </p>
            <div className="mt-8 space-y-4 text-sm text-content-variant">
              <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-[var(--portal-color)]" /> Tenant-aware access controls</div>
              <div className="flex items-center gap-3"><Building2 className="size-5 text-[var(--portal-color)]" /> Separate company workspaces</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-[var(--portal-color)]" /> HR Core available from day one</div>
            </div>
          </div>
          <div className="w-full">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--portal-color)] text-lg font-bold text-white shadow-sm">
                M
              </div>
              <div>
                <p className="text-sm font-semibold text-content">Multi-Tenants HR</p>
                <p className="text-xs text-content-variant">Secure workspace operations</p>
              </div>
            </div>
            {children}
            <p className="mt-5 text-center text-xs text-content-variant">
              One shared platform. Clear tenant boundaries. <AppVersion className="ml-1" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signIn, logout, authenticated, authLoading, user } = useSession();
  const ctx = useLoginPortalContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isAdmin = search.get('portal') === 'admin';
  const requestedTenant = search.get('tenant')?.trim().toLowerCase() || null;
  const tenantLabel =
    ctx.type === 'company' && ctx.companyName !== 'Company Workspace'
      ? ctx.companyName
      : requestedTenant
        ? `${requestedTenant} workspace`
        : 'Company Workspace';

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  /**
   * Send the browser to `slug`'s dashboard. Cached data is dropped first: a
   * cross-host move must never carry the previous tenant's context, and the
   * same-origin (dev) path keeps the in-memory cache alive across the
   * navigation, so clearing is the only thing that makes both paths equivalent.
   */
  const goToWorkspace = useCallback(
    (slug: string) => {
      queryClient.clear();
      const destination = resolveWorkspaceDestination(slug, '/dashboard');
      if (destination.startsWith('http')) {
        window.location.href = destination;
      } else {
        navigate({ to: destination });
      }
    },
    [navigate, queryClient],
  );

  // An authenticated visitor should never be shown a login form. Restoring a
  // session lands them wherever signing in would have — resolved by the same
  // pure function, so the two paths cannot disagree. Runs only once auth has
  // settled; the redirect targets are all off /login, so there is no loop.
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    if (authLoading || !authenticated || !user) return;
    let active = true;
    setRestoring(true);
    (async () => {
      try {
        const isPlatformAdmin = await platformAdminRepository.isPlatformAdmin(user);
        const company = isPlatformAdmin ? null : await companyContextRepository.getCompanyContext(user);
        if (!active) return;
        const destination = resolveLoginDestination({
          isPlatformAdmin,
          isAdminPortal: isAdmin,
          membershipSlug: company?.companySlug ?? null,
          requestedTenant,
        });
        // A platform admin restored on the company login goes to the console,
        // never into a workspace they hold no membership for.
        if (destination.kind === 'admin' || destination.kind === 'admin-on-company-login') {
          navigate({ to: '/admin' });
          return;
        }
        if (destination.kind === 'workspace') {
          if (destination.hintIgnored) notify.openedOwnWorkspace();
          goToWorkspace(destination.slug);
          return;
        }
        // Authenticated but with nowhere to go — fall through to the form.
        setRestoring(false);
      } catch {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authenticated, user, isAdmin, requestedTenant]);

  // Sign in through the auth boundary. Invalid credentials surface an inline
  // error (not toast-only); the mock adapter treats password "wrong" as invalid.
  const onSubmit = async (values: LoginForm) => {
    setAuthError(null);
    try {
      const session = await signIn({ email: values.email, password: values.password });
      const isPlatformAdmin = await platformAdminRepository.isPlatformAdmin(session.user);

      if (isAdmin) {
        if (!isPlatformAdmin) {
          await logout({ silent: true });
          setAuthError('This account is not a Platform Super Admin account. Use the company login instead.');
          return;
        }
        notify.signedIn();
        navigate({ to: '/admin' });
        return;
      }

      if (isPlatformAdmin) {
        await logout({ silent: true });
        setAuthError('Platform administrators must use the admin sign-in link.');
        return;
      }

      const company = await companyContextRepository.getCompanyContext(session.user);
      const destination = resolveLoginDestination({
        isPlatformAdmin,
        isAdminPortal: false,
        membershipSlug: company?.companySlug ?? null,
        requestedTenant,
      });

      if (destination.kind !== 'workspace') {
        await logout({ silent: true });
        setAuthError('No active company workspace is linked to this account.');
        return;
      }
      // The ?tenant= hint never decides anything — the authenticated membership
      // does. A hint naming another company is discarded (not an error), and we
      // say only that we opened the account's own workspace, disclosing nothing
      // about the company that was named.
      if (destination.hintIgnored) notify.openedOwnWorkspace();
      notify.signedIn();
      goToWorkspace(destination.slug);
    } catch (e) {
      setAuthError(e instanceof RepositoryError ? e.message : 'Sign-in failed. Please try again.');
    }
  };

  // Session restoration is in flight (or has decided to redirect): showing the
  // form here would flash a sign-in prompt at someone already signed in.
  if (authLoading || restoring) {
    return (
      <AuthLayout portalClass={isAdmin ? 'portal-admin' : 'portal-company'}>
        <Card className="p-5 sm:p-8">
          <p className="text-center text-sm text-content-variant" role="status">
            Opening your workspace…
          </p>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout portalClass={isAdmin ? 'portal-admin' : 'portal-company'}>
      <Card className="p-5 sm:p-8">
        <div className="mb-6 text-center">
          <Badge tone={isAdmin ? 'platform' : 'company'}>{isAdmin ? 'Platform Administration' : tenantLabel}</Badge>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-content">
            {isAdmin ? 'Sign in to Admin Console' : 'Sign in to your workspace'}
          </h1>
          <p className="mt-1 text-sm leading-6 text-content-variant">
            {isAdmin
              ? 'Use your Platform Super Admin credentials.'
              : 'Use your work email. We’ll open the company workspace linked to your account.'}
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-3 text-sm leading-5 text-danger"
          >
            <AlertCircle className="size-4 shrink-0" />
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, () => notify.validationFailure())} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              placeholder="you@company.com"
              {...register('email')}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                placeholder="••••••••"
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-content-variant hover:bg-surface-subtle hover:text-content"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <SubmitButton className="w-full" pending={isSubmitting} pendingLabel="Signing in…">
            Sign In
          </SubmitButton>
        </form>

        {!isAdmin && (
          <p className="mt-6 text-center text-sm text-content-variant">
            New company?{' '}
            <Link to="/register" className="font-medium text-[var(--portal-color)] underline-offset-4 hover:underline">
              Register Company
            </Link>
          </p>
        )}
      </Card>
    </AuthLayout>
  );
}

// --- Register Company ---------------------------------------------------------

const registerSchema = z
  .object({
    companyName: z.string().min(2, 'Company name is required'),
    // Format + length only. Reserved words and global uniqueness are enforced by
    // the authoritative backend (and previewed via the availability hint) so the
    // auto-derived value is never hard-blocked before the backend can suffix it.
    slug: z
      .string()
      .min(SLUG_MIN_LENGTH, `At least ${SLUG_MIN_LENGTH} characters`)
      .max(SLUG_MAX_LENGTH, `At most ${SLUG_MAX_LENGTH} characters`)
      .regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and hyphens only.'),
    adminName: z.string().min(2, 'Admin name is required'),
    adminEmail: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
  });
type RegisterForm = z.infer<typeof registerSchema>;

/** Maps a registration conflict field to the matching form field. */
const CONFLICT_FIELD_TO_FORM: Record<string, keyof RegisterForm> = {
  slug: 'slug',
  subdomain: 'slug',
  email: 'adminEmail',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const mutation = useRegisterCompany();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegisterCompanyResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const companyName = watch('companyName');
  const slug = watch('slug');
  const password = watch('password') ?? '';
  const strength = passwordStrength(password);

  // Auto-derive the slug from the company name until the founder edits it by
  // hand — then we stop syncing so their choice is preserved.
  useEffect(() => {
    if (slugEdited) return;
    const next = deriveSlug(companyName ?? '');
    setValue('slug', next, { shouldValidate: next.length > 0 });
  }, [companyName, slugEdited, setValue]);

  const availability = useSlugAvailability(slug ?? '');

  // Register page → hook → registration service → adapter. Never calls the Edge
  // Function directly. On success we show a confirmation step (a session is NOT
  // fabricated here — the founder signs in explicitly from there).
  const onValid = async (values: RegisterForm) => {
    setRegisterError(null);
    try {
      const result = await mutation.mutateAsync({
        companyName: values.companyName,
        // Only send a slug when the founder deliberately chose one. Otherwise the
        // backend derives a unique slug from the name (authoritative allocation).
        slug: slugEdited ? values.slug : undefined,
        adminName: values.adminName,
        email: values.adminEmail,
        password: values.password,
      });
      setCreated(result);
    } catch (e) {
      // Field-specific errors (taken / reserved / invalid slug, duplicate email)
      // land on their input; everything else is a banner.
      if (e instanceof RepositoryError && e.field) {
        const formField = CONFLICT_FIELD_TO_FORM[e.field];
        if (formField) {
          setError(formField, { type: 'server', message: e.message });
          if (formField === 'slug') setSlugEdited(true);
          return;
        }
      }
      setRegisterError(e instanceof RepositoryError ? e.message : 'Registration failed. Please try again.');
    }
  };

  if (created) {
    return (
      <AuthLayout portalClass="portal-company">
        <Card className="p-5 text-center sm:p-8">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy">
            <CheckCircle2 className="size-8" />
          </div>
          <Badge tone="company">Company created</Badge>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-content">Your workspace is ready</h1>
          <p className="mt-2 text-sm leading-6 text-content-variant">
            HR Core {created.hrCore.version} has been assigned automatically. Sign in with the admin account you
            just created to open your workspace.
          </p>
          <dl className="mt-5 space-y-2 rounded-md border border-border bg-surface-subtle px-4 py-3 text-left text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-content-variant">Workspace URL</dt>
              {/* The backend-persisted slug — never re-derived from the name. */}
              <dd className="break-all font-medium text-content">
                {workspaceHost(created.slug)}/dashboard
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-content-variant">Starter package</dt>
              <dd className="font-medium text-content">HR Core {created.hrCore.version}</dd>
            </div>
          </dl>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              // Preferred: the new company's own login host. In dev (no real
              // subdomains) fall back to the public hand-off, which the login
              // page validates against the authenticated membership anyway.
              const direct = registrationHandoffUrl(created.slug);
              if (direct) window.location.href = direct;
              else navigate({ to: '/login', search: { tenant: created.slug } });
            }}
          >
            Continue to sign in
          </Button>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout portalClass="portal-company">
      <Card className="p-5 sm:p-8">
        <div className="mb-6">
          <Badge tone="company">Company onboarding</Badge>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-content">Register your company</h1>
          <p className="mt-1 text-sm leading-6 text-content-variant">
            Company self-registration. HR Core is assigned automatically.
          </p>
        </div>
        {registerError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-3 text-sm leading-5 text-danger"
          >
            <AlertCircle className="size-4 shrink-0" />
            {registerError}
          </div>
        )}
        <form onSubmit={handleSubmit(onValid, () => notify.validationFailure())} className="space-y-4" noValidate>
          <div className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-content-variant">
            Company details
          </div>
          <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" aria-invalid={!!errors.companyName} {...register('companyName')} />
          </Field>
          <Field
            label="Workspace URL"
            htmlFor="slug"
            error={errors.slug?.message}
            hint="Auto-filled from your company name; edit if you like."
          >
            {/* Prefix + suffix frame the slug so the founder sees the final URL. */}
            <div
              className={cn(
                'flex items-center rounded-md border bg-surface text-sm focus-within:ring-2 focus-within:ring-[var(--portal-color)]/40',
                errors.slug ? 'border-danger' : 'border-border',
              )}
            >
              <input
                id="slug"
                aria-invalid={!!errors.slug}
                aria-describedby="slug-availability"
                placeholder="acme-corp"
                className="min-w-0 flex-1 bg-transparent py-2 pl-3 text-content outline-none placeholder:text-content-variant/60"
                {...register('slug', {
                  onChange: (e) => {
                    setSlugEdited(true);
                    // Normalize toward the stored shape (lowercase) as they type.
                    e.target.value = e.target.value.toLowerCase();
                  },
                })}
              />
              <span className="shrink-0 whitespace-nowrap py-2 pr-3 text-content-variant" aria-hidden>
                .{appBaseDomain()}
              </span>
            </div>
            <SlugAvailabilityHint slug={slug ?? ''} query={availability} hasFormatError={!!errors.slug} />
          </Field>
          <div className="border-b border-border pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-content-variant">
            Company administrator
          </div>
          <Field label="Admin full name" htmlFor="adminName" error={errors.adminName?.message}>
            <Input id="adminName" aria-invalid={!!errors.adminName} {...register('adminName')} />
          </Field>
          <Field label="Admin email" htmlFor="adminEmail" error={errors.adminEmail?.message}>
            <Input id="adminEmail" type="email" aria-invalid={!!errors.adminEmail} {...register('adminEmail')} />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint="Use at least 8 characters."
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-content-variant hover:bg-surface-subtle hover:text-content"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <PasswordStrengthMeter strength={strength} />
          </Field>
          <SubmitButton className="w-full" pending={mutation.isPending} pendingLabel="Creating company…">
            Create company
          </SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-content-variant">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-[var(--portal-color)]">
            Login
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}

/**
 * Live workspace-URL feedback under the slug field. Reserved/invalid are
 * client-side truth (instant); taken/available comes from the debounced
 * availability check. Rendered in a fixed-height, politely-announced region so
 * there is no layout jump and non-color cues (icons + text) are always present.
 */
function SlugAvailabilityHint({
  slug,
  query,
  hasFormatError,
}: {
  slug: string;
  query: ReturnType<typeof useSlugAvailability>;
  hasFormatError: boolean;
}) {
  const value = slug.trim();
  const issue = slugIssue(value);
  const data = query.data;

  let content: ReactNode = <span className="text-content-variant">Lowercase letters, numbers, and hyphens.</span>;
  let tone: 'muted' | 'good' | 'bad' = 'muted';

  if (issue === 'reserved') {
    tone = 'bad';
    content = 'This workspace URL is reserved.';
  } else if (hasFormatError || (issue && issue !== 'empty')) {
    tone = 'bad';
    content = 'Use lowercase letters, numbers, and hyphens only.';
  } else if (value.length === 0) {
    content = <span className="text-content-variant">Lowercase letters, numbers, and hyphens.</span>;
  } else if (query.isFetching) {
    content = <span className="text-content-variant">Checking availability…</span>;
  } else if (data && data.slug === value && data.verified) {
    tone = data.available ? 'good' : 'bad';
    content = data.available ? 'This workspace URL is available.' : 'This workspace URL is already taken.';
  } else if (query.isError) {
    // A permission/network failure says NOTHING about the slug. Never render it
    // as a format problem — and never block submission, since the backend
    // re-checks authoritatively anyway.
    content = (
      <span className="text-content-variant">We couldn’t verify this workspace URL right now. You can still submit.</span>
    );
  } else {
    content = <span className="text-content-variant">Availability is confirmed when you submit.</span>;
  }

  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? AlertCircle : null;
  return (
    <p
      id="slug-availability"
      aria-live="polite"
      className={cn(
        'mt-1.5 flex min-h-[1.25rem] items-center gap-1.5 text-xs',
        tone === 'good' && 'text-status-healthy',
        tone === 'bad' && 'text-danger',
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {content}
    </p>
  );
}

/** Advisory password-strength bar (does not gate submit). */
function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  if (strength === 'empty') return null;
  const fill = strength === 'weak' ? 1 : strength === 'fair' ? 2 : 3;
  const color =
    strength === 'weak' ? 'bg-danger' : strength === 'fair' ? 'bg-status-degraded' : 'bg-status-healthy';
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1 flex-1 rounded-full', i <= fill ? color : 'bg-border')}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-content-variant">
        Password strength: <span className="font-medium text-content">{PASSWORD_STRENGTH_LABEL[strength]}</span>
      </p>
    </div>
  );
}

// --- Access Denied / Company Suspended (routes reuse shared state components) --

export function AccessDeniedPage() {
  return (
    <AuthLayout portalClass="portal-admin">
      <AccessDeniedState description="You do not have permission to view this resource, or the package it belongs to is not enabled for your company." />
      <div className="mt-4 text-center">
        <Link to="/login">
          <Button variant="secondary">Back to Login</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}

export function CompanySuspendedPage() {
  return (
    <AuthLayout portalClass="portal-admin">
      <CompanySuspendedState />
      <div className="mt-4 text-center">
        <Link to="/login">
          <Button variant="secondary">Back to Login</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
