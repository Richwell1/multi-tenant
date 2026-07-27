import { useState } from 'react';
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
import { useRegisterCompany } from '@/hooks/use-register-company';
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
  const { signIn, logout } = useSession();
  const ctx = useLoginPortalContext();
  const navigate = useNavigate();
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
      if (!company) {
        await logout({ silent: true });
        setAuthError('No active company workspace is linked to this account.');
        return;
      }
      if (requestedTenant && company.companySlug !== requestedTenant) {
        await logout({ silent: true });
        setAuthError(`This account belongs to ${company.companyName}, not the ${requestedTenant} workspace.`);
        return;
      }
      notify.signedIn();
      navigate({ to: '/dashboard' });
    } catch (e) {
      setAuthError(e instanceof RepositoryError ? e.message : 'Sign-in failed. Please try again.');
    }
  };

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
    slug: z
      .string()
      .min(2, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
    adminName: z.string().min(2, 'Admin name is required'),
    adminEmail: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const mutation = useRegisterCompany();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const slug = watch('slug');

  // Register page → hook → registration service → adapter. Never calls the Edge
  // Function directly. On success we route to the company login (a session is
  // NOT fabricated here — the founder signs in explicitly).
  const onValid = async (values: RegisterForm) => {
    setRegisterError(null);
    try {
      const result = await mutation.mutateAsync({
        companyName: values.companyName,
        slug: values.slug,
        requestedSubdomain: values.slug,
        adminName: values.adminName,
        email: values.adminEmail,
        password: values.password,
      });
      navigate({ to: '/login', search: { tenant: result.slug } });
    } catch (e) {
      setRegisterError(e instanceof RepositoryError ? e.message : 'Registration failed. Please try again.');
    }
  };

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
            label="Company slug"
            htmlFor="slug"
            error={errors.slug?.message}
            hint={slug ? `${slug}.multi-tenants-hr.com` : 'Used for your subdomain'}
          >
            <Input id="slug" aria-invalid={!!errors.slug} placeholder="acme-corp" {...register('slug')} />
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
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
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
