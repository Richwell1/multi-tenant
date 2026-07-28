import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepositoryError } from '@/data/errors';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => navigate,
}));
vi.mock('@/hooks/use-register-company', () => ({
  useRegisterCompany: vi.fn(),
  useSlugAvailability: vi.fn(),
}));

import { RegisterPage } from './public';
import { useRegisterCompany, useSlugAvailability } from '@/hooks/use-register-company';

function mockMutation(over: Partial<{ mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
  vi.mocked(useRegisterCompany).mockReturnValue({
    mutateAsync: over.mutateAsync ?? vi.fn().mockResolvedValue({}),
    isPending: over.isPending ?? false,
  } as unknown as ReturnType<typeof useRegisterCompany>);
}
function mockAvailability(data: unknown, isFetching = false) {
  vi.mocked(useSlugAvailability).mockReturnValue({
    data,
    isFetching,
  } as unknown as ReturnType<typeof useSlugAvailability>);
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Rich Co' } });
  fireEvent.change(screen.getByLabelText('Admin full name'), { target: { value: 'Rich Owner' } });
  fireEvent.change(screen.getByLabelText('Admin email'), { target: { value: 'owner@rich.co' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ngPass1' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Str0ngPass1' } });
}

describe('RegisterPage UX', () => {
  beforeEach(() => {
    navigate.mockClear();
    mockMutation();
    mockAvailability(undefined);
  });

  it('auto-derives the slug from the company name', () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme Corp!' } });
    expect(screen.getByLabelText('Workspace URL')).toHaveValue('acme-corp');
  });

  it('stops syncing the slug once the user edits it by hand', () => {
    render(<RegisterPage />);
    const slug = screen.getByLabelText('Workspace URL');
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme' } });
    fireEvent.change(slug, { target: { value: 'custom-slug' } });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme Two' } });
    expect(slug).toHaveValue('custom-slug');
  });

  it('shows a live "available" hint from the availability check', () => {
    mockAvailability({ slug: 'acme-corp', available: true, verified: true });
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme Corp' } });
    expect(screen.getByText('This workspace URL is available.')).toBeInTheDocument();
  });

  it('flags a reserved slug client-side without an availability call', () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Workspace URL'), { target: { value: 'admin' } });
    expect(screen.getByText('This workspace URL is reserved.')).toBeInTheDocument();
  });

  it('previews the workspace subdomain URL and wires slug accessibility', () => {
    render(<RegisterPage />);
    // The domain suffix frames the slug (subdomain-style: [slug].merbsconnect.com).
    expect(screen.getByText('.merbsconnect.com')).toBeInTheDocument();
    const slug = screen.getByLabelText('Workspace URL');
    expect(slug).toHaveAttribute('aria-describedby', 'slug-availability');
  });

  it('toggles password visibility', () => {
    render(<RegisterPage />);
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('shows a success confirmation step instead of navigating immediately', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      companyId: 'c1',
      slug: 'rich-co',
      subdomain: 'rich-co',
      role: 'company_admin',
      hrCore: { packageKey: 'hr-core', version: '1.0.0' },
    });
    mockMutation({ mutateAsync });
    render(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create company/i }));
    expect(await screen.findByText(/your workspace is ready/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    // The founder advances explicitly.
    fireEvent.click(screen.getByRole('button', { name: /continue to sign in/i }));
    expect(navigate).toHaveBeenCalledWith({ to: '/login', search: { tenant: 'rich-co' } });
  });

  it('surfaces a duplicate-slug conflict inline on the slug field', async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new RepositoryError('That company slug is already taken.', 'conflict', undefined, 'slug'));
    mockMutation({ mutateAsync });
    render(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: /create company/i }));
    expect(await screen.findByText('That company slug is already taken.')).toBeInTheDocument();
    // Lands inline on the slug field (aria-invalid), not as the generic top banner.
    expect(screen.getByLabelText('Workspace URL')).toHaveAttribute('aria-invalid', 'true');
    // Exactly one alert (the field error) — the message isn't duplicated in a banner.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
