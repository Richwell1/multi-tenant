import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/queries', async (orig) => ({
  ...(await orig<typeof import('@/hooks/queries')>()),
  useCompanies: vi.fn(),
}));

import { CompaniesList } from './admin';
import { useCompanies } from '@/hooks/queries';
import type { Company } from '@/data/types';

const co = (over: Partial<Company>): Company => ({
  id: 'c', name: 'Test Company One', slug: 'one', subdomain: 'one', status: 'active',
  adminEmail: 'a@x.com', employeeCount: 3, createdAt: '2026-01-01T00:00:00Z', packages: ['hr-core'], ...over,
});

const COMPANIES: Company[] = [
  co({ id: 'c1', name: 'Acme Co', status: 'active', packages: ['hr-core', 'attendance-management'] }),
  co({ id: 'c2', name: 'Globex Co', status: 'suspended', packages: ['hr-core'] }),
];

function setup(data = COMPANIES) {
  vi.mocked(useCompanies).mockReturnValue({ data, isPending: false, isError: false, isFetching: false } as ReturnType<typeof useCompanies>);
  return render(<CompaniesList />);
}

describe('CompaniesList polish', () => {
  it('shows a summary, avatars, and clickable names', () => {
    setup();
    expect(screen.getByText('Acme Co')).toBeInTheDocument();
    expect(screen.getByText('Globex Co')).toBeInTheDocument();
    // Avatar initials (A for Acme, G for Globex).
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    // Company summary line.
    expect(screen.getByText((_, el) => el?.textContent === '2 companies · 1 active')).toBeInTheDocument();
  });

  it('filters by status', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Suspended' }));
    expect(screen.getByText('Globex Co')).toBeInTheDocument();
    expect(screen.queryByText('Acme Co')).toBeNull();
  });
});
