import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/marketplace', () => ({ useMarketplaceAdoption: vi.fn(), useInstallMarketplaceExtension: vi.fn() }));
vi.mock('@/hooks/queries', async (orig) => ({
  ...(await orig<typeof import('@/hooks/queries')>()),
  useCompanies: vi.fn(),
}));

import { AdoptionPage } from './admin';
import { useMarketplaceAdoption } from '@/hooks/marketplace';
import { useCompanies } from '@/hooks/queries';
import type { Company } from '@/data/types';

const activeCompanies = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Co ${i}`, status: 'active' })) as unknown as Company[];

describe('AdoptionPage', () => {
  it('renders an adoption progress bar as a percentage of active companies', () => {
    vi.mocked(useMarketplaceAdoption).mockReturnValue({
      data: [{ packageKey: 'document-notes', packageName: 'Document Notes', installCount: 5, distinctCompanies: 2 }],
      isPending: false, isError: false, isFetching: false,
    } as ReturnType<typeof useMarketplaceAdoption>);
    vi.mocked(useCompanies).mockReturnValue({ data: activeCompanies(4), isPending: false, isError: false, isFetching: false } as ReturnType<typeof useCompanies>);

    render(<AdoptionPage />);
    // 2 of 4 active companies → 50%.
    const bar = screen.getByRole('progressbar', { name: /Document Notes adoption/ });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50%')).toBeInTheDocument();
    // Appears in both the "Most installed" summary and the table row.
    expect(screen.getAllByText('Document Notes').length).toBeGreaterThanOrEqual(2);
  });
});
