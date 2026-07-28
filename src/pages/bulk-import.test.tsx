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
vi.mock('@/hooks/departments', () => ({ useDepartments: vi.fn() }));
vi.mock('@/hooks/bulk-import', () => ({ useBulkImportDepartments: vi.fn() }));

import { BulkImportPage } from './workspace';
import { useDepartments } from '@/hooks/departments';
import { useBulkImportDepartments } from '@/hooks/bulk-import';

const mutate = vi.fn();
beforeEach(() => {
  mutate.mockReset();
  vi.mocked(useDepartments).mockReturnValue({ data: [{ id: 'd1' }] } as unknown as ReturnType<typeof useDepartments>);
  vi.mocked(useBulkImportDepartments).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useBulkImportDepartments>);
});

describe('BulkImportPage', () => {
  it('counts unique rows and imports them', () => {
    render(<BulkImportPage />);
    fireEvent.change(screen.getByLabelText('Departments (one per line)'), {
      target: { value: 'Engineering\nSales\nengineering\n' },
    });
    // 2 unique rows.
    expect(screen.getByRole('button', { name: /import 2 departments/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /import 2 departments/i }));
    expect(mutate).toHaveBeenCalledWith(['Engineering', 'Sales'], expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it('disables import when there is nothing to import', () => {
    render(<BulkImportPage />);
    expect(screen.getByRole('button', { name: /import departments/i })).toBeDisabled();
  });
});
