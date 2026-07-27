import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/lib/session', () => ({ useSession: () => ({ company: { name: 'Rich Co' } }) }));
vi.mock('@/hooks/context', () => ({ useCompanyContext: () => ({ data: { companyName: 'Rich Co' } }) }));
vi.mock('@/hooks/entitlements', () => ({
  usePackageEntitlements: () => ({ codes: ['hr-core'], packages: [{ code: 'hr-core', version: '1.1.0' }] }),
  useHasPackage: () => false,
}));
vi.mock('@/hooks/company-updates', () => ({
  useAvailableUpdateCount: () => 2,
  useAvailableUpdates: vi.fn(),
  useInstallCompanyUpdate: vi.fn(),
}));
const list = (n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ id: `x${i}` })), isPending: false, isError: false, isFetching: false });
vi.mock('@/hooks/employees', async (orig) => ({ ...(await orig<typeof import('@/hooks/employees')>()), useEmployees: () => list(3) }));
vi.mock('@/hooks/departments', async (orig) => ({ ...(await orig<typeof import('@/hooks/departments')>()), useDepartments: () => list(2) }));
vi.mock('@/hooks/positions', async (orig) => ({ ...(await orig<typeof import('@/hooks/positions')>()), usePositions: () => list(1) }));

import { WorkspaceDashboard } from './workspace';

describe('WorkspaceDashboard', () => {
  it('renders a welcome header, metric cards, and the installed packages summary', () => {
    render(<WorkspaceDashboard />);
    expect(screen.getByRole('heading', { name: 'Rich Co' })).toBeInTheDocument();
    expect(screen.getByText('HR Core 1.1.0')).toBeInTheDocument();
    // Metric labels.
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Available Updates')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // employees value
    // Installed packages summary lists HR Core.
    expect(screen.getByText('Installed packages')).toBeInTheDocument();
  });
});
