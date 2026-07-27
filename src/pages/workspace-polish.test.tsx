import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Router Link isn't exercised in these pages; stub to avoid router setup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/entitlements', () => ({
  usePackageEntitlements: vi.fn(),
  useHasPackage: () => false,
}));
vi.mock('@/hooks/use-company-id', () => ({ useCompanyId: () => 'rich-co' }));

import { DepartmentsPage } from './workspace';
import { usePackageEntitlements } from '@/hooks/entitlements';
import * as departmentsHooks from '@/hooks/departments';

const entitle = (packages: { code: string; version: string | null }[]) =>
  vi.mocked(usePackageEntitlements).mockReturnValue({
    codes: packages.map((p) => p.code),
    packages,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof usePackageEntitlements>);

describe('DepartmentsPage empty state', () => {
  it('offers an Add Department action from the empty state and opens the form', () => {
    entitle([{ code: 'hr-core', version: '1.0.0' }]);
    vi.spyOn(departmentsHooks, 'useDepartments').mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof departmentsHooks.useDepartments>);
    vi.spyOn(departmentsHooks, 'useCreateDepartment').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof departmentsHooks.useCreateDepartment>);
    vi.spyOn(departmentsHooks, 'useDisableDepartment').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof departmentsHooks.useDisableDepartment>);

    render(<DepartmentsPage />);
    expect(screen.getByText('No departments yet')).toBeInTheDocument();
    // The empty-state action and the header action both read "Add Department".
    const addButtons = screen.getAllByRole('button', { name: 'Add Department' });
    expect(addButtons.length).toBeGreaterThanOrEqual(2);
    // Clicking the empty-state action reveals the create form.
    fireEvent.click(addButtons[addButtons.length - 1]!);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
