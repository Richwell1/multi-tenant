import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccessDeniedState, CompanySuspendedState } from '@/components/states';
import { useSession } from '@/lib/session';
import { useLoginPortalContext } from '@/hooks/use-login-portal-context';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

// --- Auth: email + password only (no reset, MFA, invitations, social) ---------

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

function AuthLayout({ children, portalClass }: { children: React.ReactNode; portalClass: string }) {
  return (
    <div className={cn('flex min-h-screen items-center justify-center bg-background p-4', portalClass)}>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useSession();
  const ctx = useLoginPortalContext();
  const navigate = useNavigate();
  const isAdmin = ctx.type === 'platform_admin';

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  // Mock auth: any credentials succeed EXCEPT the sentinel password "wrong",
  // which surfaces the inline invalid-credentials state (not toast-only).
  const onSubmit = async (values: LoginForm) => {
    setAuthError(null);
    await new Promise((r) => setTimeout(r, 400));
    if (values.password === 'wrong') {
      setAuthError('Invalid email or password. Please try again.');
      return;
    }
    login(values.email);
    navigate({ to: isAdmin ? '/admin' : '/dashboard' });
  };

  return (
    <AuthLayout portalClass={isAdmin ? 'portal-admin' : 'portal-company'}>
      <Card className="p-8">
        <div className="mb-6 text-center">
          <Badge tone={isAdmin ? 'platform' : 'company'}>
            {isAdmin ? ctx.name : ctx.companyName}
          </Badge>
          <h1 className="mt-3 text-2xl font-bold text-content">Multi-Tenants HR</h1>
          <p className="mt-1 text-sm text-content-variant">Sign in with your email and password</p>
        </div>

        {authError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-content-variant hover:text-content"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <SubmitButton className="w-full" pending={isSubmitting} pendingLabel="Signing in…">
            Sign In
          </SubmitButton>
        </form>

        {ctx.showRegistration && (
          <p className="mt-6 text-center text-sm text-content-variant">
            New company?{' '}
            <Link to="/register" className="font-medium text-[var(--portal-color)]">
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
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const slug = watch('slug');

  const onValid = () => {
    // Phase 1: no backend. Simulate success then route to login.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        notify.recordCreated('Company');
        navigate({ to: '/login' });
        resolve();
      }, 600);
    });
  };

  return (
    <AuthLayout portalClass="portal-company">
      <Card className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-content">Register your company</h1>
          <p className="mt-1 text-sm text-content-variant">
            Company self-registration. HR Core is assigned automatically.
          </p>
        </div>
        <form onSubmit={handleSubmit(onValid, () => notify.validationFailure())} className="space-y-4" noValidate>
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
          <Field label="Admin full name" htmlFor="adminName" error={errors.adminName?.message}>
            <Input id="adminName" aria-invalid={!!errors.adminName} {...register('adminName')} />
          </Field>
          <Field label="Admin email" htmlFor="adminEmail" error={errors.adminEmail?.message}>
            <Input id="adminEmail" type="email" aria-invalid={!!errors.adminEmail} {...register('adminEmail')} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <Input
              id="confirmPassword"
              type="password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </Field>
          <SubmitButton
            className="w-full"
            pending={isSubmitting || isSubmitSuccessful}
            pendingLabel="Creating company…"
          >
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
