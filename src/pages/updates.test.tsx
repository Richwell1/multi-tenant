import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/company-updates', () => ({
  useAvailableUpdates: vi.fn(),
  useInstallCompanyUpdate: vi.fn(),
  useAvailableUpdateCount: vi.fn(() => 0),
}));

import { UpdatesPage } from './workspace';
import { useAvailableUpdates, useInstallCompanyUpdate } from '@/hooks/company-updates';
import type { AvailableUpdate } from '@/data/company-updates';

const upd = (over: Partial<AvailableUpdate>): AvailableUpdate => ({
  releaseId: 'r', installationId: 'i', packageKey: 'k', packageName: 'K',
  category: 'standard_package', installedVersion: '1.0.0', availableVersion: '1.1.0',
  basePackageName: null, releaseNotes: '', releasedAt: null, installationState: 'pending',
  updatePolicy: 'company_managed', automaticInstall: false, ...over,
});

const UPDATES: AvailableUpdate[] = [
  upd({ installationId: 'inst-hr', packageKey: 'hr-core', packageName: 'HR Core', category: 'standard_package' }),
  upd({ installationId: 'inst-dc', packageKey: 'custom-department-code', packageName: 'Custom Department Code Field', category: 'private_extension', basePackageName: 'HR Core' }),
];

function setup(data: AvailableUpdate[], install: { isPending: boolean; variables?: string }) {
  vi.mocked(useAvailableUpdates).mockReturnValue({ data, isPending: false, isError: false, isFetching: false } as ReturnType<typeof useAvailableUpdates>);
  vi.mocked(useInstallCompanyUpdate).mockReturnValue({ mutate: vi.fn(), isPending: install.isPending, variables: install.variables } as unknown as ReturnType<typeof useInstallCompanyUpdate>);
  return render(<UpdatesPage />);
}

describe('UpdatesPage', () => {
  it('renders multiple updates with human categories (no raw enums)', () => {
    setup(UPDATES, { isPending: false });
    expect(screen.getByText('System Package')).toBeInTheDocument();
    expect(screen.getByText('Private Extension')).toBeInTheDocument();
    expect(screen.getByText('Extends HR Core')).toBeInTheDocument();
    expect(screen.queryByText(/standard_update|private_extension|standard update/)).toBeNull();
  });

  it('shows Installing only on the update being installed', () => {
    setup(UPDATES, { isPending: true, variables: 'inst-hr' });
    expect(screen.getByRole('button', { name: 'Install update for HR Core' })).toHaveTextContent('Installing…');
    expect(screen.getByRole('button', { name: 'Install update for HR Core' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Install update for Custom Department Code Field' })).toHaveTextContent('Install Update');
    expect(screen.getByRole('button', { name: 'Install update for Custom Department Code Field' })).not.toBeDisabled();
  });

  it('shows the up-to-date empty state when there are no updates', () => {
    setup([], { isPending: false });
    expect(screen.getByText('Your packages are up to date')).toBeInTheDocument();
    expect(screen.getByText('View Installed Packages')).toBeInTheDocument();
  });
});
