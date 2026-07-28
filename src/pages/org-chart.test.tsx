import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({ companySlug: 'alpha' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/guards', () => ({
  PackageGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/departments', () => ({ useDepartments: vi.fn() }));
vi.mock('@/hooks/positions', () => ({ usePositions: vi.fn() }));
vi.mock('@/hooks/employees', () => ({ useEmployees: vi.fn() }));

import { OrgChartPage } from './workspace';
import { useDepartments } from '@/hooks/departments';
import { usePositions } from '@/hooks/positions';
import { useEmployees } from '@/hooks/employees';

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, isFetching: false, refetch: vi.fn() });

describe('OrgChartPage', () => {
  it('renders departments with their positions and headcount from HR Core data', () => {
    vi.mocked(useDepartments).mockReturnValue(ok([
      { id: 'd1', name: 'Engineering', head: 'Ada', status: 'active' },
      { id: 'd2', name: 'Sales', head: '', status: 'inactive' }, // filtered out
    ]) as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(usePositions).mockReturnValue(ok([
      { id: 'p1', title: 'Staff Engineer', department: 'Engineering', reportsTo: 'CTO', status: 'active' },
    ]) as unknown as ReturnType<typeof usePositions>);
    vi.mocked(useEmployees).mockReturnValue(ok([
      { id: 'e1', department: 'Engineering' },
      { id: 'e2', department: 'Engineering' },
    ]) as unknown as ReturnType<typeof useEmployees>);

    render(<OrgChartPage />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Head: Ada')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByText('reports to CTO')).toBeInTheDocument();
    expect(screen.getByText('2 people')).toBeInTheDocument();
    // Inactive department is not shown.
    expect(screen.queryByText('Sales')).toBeNull();
  });

  it('shows an empty state when there are no active departments', () => {
    vi.mocked(useDepartments).mockReturnValue(ok([]) as unknown as ReturnType<typeof useDepartments>);
    vi.mocked(usePositions).mockReturnValue(ok([]) as unknown as ReturnType<typeof usePositions>);
    vi.mocked(useEmployees).mockReturnValue(ok([]) as unknown as ReturnType<typeof useEmployees>);
    render(<OrgChartPage />);
    expect(screen.getByText('No departments yet')).toBeInTheDocument();
  });
});
