import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({ companySlug: 'alpha' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/components/guards', () => ({
  PackageGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/assets', () => ({ useAssets: vi.fn(), useCreateAsset: vi.fn() }));
vi.mock('@/hooks/use-company-id', () => ({ useCompanyId: () => 'alpha' }));

import { AssetRegisterPage } from './workspace';
import { useAssets, useCreateAsset } from '@/hooks/assets';

const mutate = vi.fn();
function setup(items: Array<{ id: string; name: string; assetTag: string; assignedTo: string; status: string; createdAt: string }>) {
  vi.mocked(useAssets).mockReturnValue({
    data: items, isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAssets>);
  vi.mocked(useCreateAsset).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCreateAsset>);
}

describe('AssetRegisterPage', () => {
  beforeEach(() => mutate.mockClear());

  it('shows the empty state and adds an asset', () => {
    setup([]);
    render(<AssetRegisterPage />);
    expect(screen.getByText('No assets yet')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Laptop' } });
    fireEvent.change(screen.getByLabelText('Asset Tag'), { target: { value: 'LT-9' } });
    fireEvent.change(screen.getByLabelText('Assigned To'), { target: { value: 'Rich' } });
    fireEvent.click(screen.getByRole('button', { name: /add asset/i }));
    expect(mutate).toHaveBeenCalledWith(
      { name: 'Laptop', assetTag: 'LT-9', assignedTo: 'Rich' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('lists assets with their status', () => {
    setup([{ id: 'a1', name: 'Laptop', assetTag: 'LT-1', assignedTo: 'Rich', status: 'assigned', createdAt: new Date().toISOString() }]);
    render(<AssetRegisterPage />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('LT-1')).toBeInTheDocument();
    expect(screen.getByText('assigned')).toBeInTheDocument();
  });
});
