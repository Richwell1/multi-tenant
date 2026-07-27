import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Link isn't exercised here (nothing installed); stub it to avoid router setup.
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/marketplace', () => ({
  useMarketplacePackages: vi.fn(),
  useInstallMarketplaceExtension: vi.fn(),
  useMarketplaceAdoption: vi.fn(),
}));
vi.mock('@/hooks/entitlements', () => ({ usePackageEntitlements: vi.fn(), useHasPackage: vi.fn(() => false) }));
vi.mock('@/hooks/context', () => ({ useCompanyContext: vi.fn() }));

import { MarketplacePage } from './workspace';
import { useMarketplacePackages, useInstallMarketplaceExtension } from '@/hooks/marketplace';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { useCompanyContext } from '@/hooks/context';

const cat = (over: object) => (over as ReturnType<typeof useMarketplacePackages>);

function setup(installState: { isPending: boolean; variables?: string }) {
  vi.mocked(useMarketplacePackages).mockReturnValue(cat({
    data: [
      { code: 'document-notes', name: 'Document Notes', description: '', latestVersion: '1.0.0' },
      { code: 'expense-requests', name: 'Expense Requests', description: '', latestVersion: '1.0.0' },
    ],
    isPending: false,
    isError: false,
  }));
  vi.mocked(usePackageEntitlements).mockReturnValue({ codes: [], packages: [], isPending: false, isError: false });
  vi.mocked(useCompanyContext).mockReturnValue({ data: { role: 'company_admin' } } as ReturnType<typeof useCompanyContext>);
  vi.mocked(useInstallMarketplaceExtension).mockReturnValue({
    mutate: vi.fn(),
    isPending: installState.isPending,
    variables: installState.variables,
  } as unknown as ReturnType<typeof useInstallMarketplaceExtension>);
}

describe('MarketplacePage pending state is package-specific', () => {
  it('shows Installing only on the card being installed', () => {
    setup({ isPending: true, variables: 'document-notes' });
    render(<MarketplacePage />);
    expect(screen.getByRole('button', { name: 'Install Document Notes' })).toHaveTextContent('Installing…');
    expect(screen.getByRole('button', { name: 'Install Document Notes' })).toBeDisabled();
    // The other card is unaffected and still usable.
    expect(screen.getByRole('button', { name: 'Install Expense Requests' })).toHaveTextContent('Install');
    expect(screen.getByRole('button', { name: 'Install Expense Requests' })).not.toBeDisabled();
  });

  it('shows Install on all cards when nothing is installing', () => {
    setup({ isPending: false });
    render(<MarketplacePage />);
    expect(screen.getByRole('button', { name: 'Install Document Notes' })).toHaveTextContent('Install');
    expect(screen.getByRole('button', { name: 'Install Expense Requests' })).toHaveTextContent('Install');
  });

  it('filters by category and search', () => {
    setup({ isPending: false });
    render(<MarketplacePage />);
    // Finance category → only Expense Requests (Document Notes is Productivity).
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
    expect(screen.getByRole('button', { name: 'Install Expense Requests' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install Document Notes' })).toBeNull();
    // Back to All, then search narrows.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Search extensions'), { target: { value: 'notes' } });
    expect(screen.getByRole('button', { name: 'Install Document Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install Expense Requests' })).toBeNull();
  });
});
