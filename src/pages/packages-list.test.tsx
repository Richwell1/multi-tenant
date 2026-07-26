import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/packages', async (orig) => ({
  ...(await orig<typeof import('@/hooks/packages')>()),
  usePackages: vi.fn(),
}));

import { PackagesList } from './admin';
import { usePackages } from '@/hooks/packages';
import type { Package } from '@/data/packages';

const pkg = (over: Partial<Package>): Package => ({
  code: 'x',
  name: 'X',
  description: '',
  classification: 'standard_update',
  category: 'standard_package',
  basePackageKey: null,
  isActive: true,
  ...over,
});

const CATALOG: Package[] = [
  pkg({ code: 'hr-core', name: 'HR Core', category: 'standard_package' }),
  pkg({ code: 'document-notes', name: 'Document Notes', category: 'marketplace_extension' }),
  pkg({ code: 'custom-employee-approval', name: 'Custom Employee Approval Card', classification: 'private_extension', category: 'private_extension', basePackageKey: 'hr-core' }),
  pkg({ code: 'custom-visitor-register', name: 'Custom Visitor Register', classification: 'private_customization', category: 'private_standalone' }),
];

function setup(data = CATALOG) {
  vi.mocked(usePackages).mockReturnValue({ data, isPending: false, isError: false, isFetching: false } as ReturnType<typeof usePackages>);
  return render(<PackagesList />);
}

describe('PackagesList category presentation', () => {
  it('renders human-readable categories, never raw enum values', () => {
    setup();
    const table = screen.getByRole('table');
    expect(within(table).getByText('System Package')).toBeInTheDocument();
    expect(within(table).getByText('Marketplace Extension')).toBeInTheDocument();
    expect(within(table).getByText('Private Extension')).toBeInTheDocument();
    expect(within(table).getByText('Private Standalone Package')).toBeInTheDocument();
    // Raw enum values must not appear anywhere.
    expect(screen.queryByText(/standard_update|private_extension|private_customization|standard update/)).toBeNull();
  });

  it('shows the base package for a private extension and — for a standalone', () => {
    setup();
    const extRow = screen.getByText('Custom Employee Approval Card').closest('tr')!;
    expect(within(extRow).getByText('HR Core')).toBeInTheDocument();
    const standaloneRow = screen.getByText('Custom Visitor Register').closest('tr')!;
    expect(within(standaloneRow).getByText('—')).toBeInTheDocument();
  });

  it('filters by category', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Marketplace Extension' }));
    expect(screen.getByText('Document Notes')).toBeInTheDocument();
    expect(screen.queryByText('HR Core')).toBeNull();
  });
});
