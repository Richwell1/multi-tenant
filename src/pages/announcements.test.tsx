import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({ companySlug: 'alpha' }),
  useNavigate: () => vi.fn(),
}));
// Entitlement guard is exercised separately; render the content directly.
vi.mock('@/components/guards', () => ({
  PackageGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/announcements', () => ({
  useAnnouncements: vi.fn(),
  useCreateAnnouncement: vi.fn(),
}));
vi.mock('@/hooks/use-company-id', () => ({ useCompanyId: () => 'alpha' }));

import { AnnouncementsPage } from './workspace';
import { useAnnouncements, useCreateAnnouncement } from '@/hooks/announcements';

const mutate = vi.fn();
function setup(items: Array<{ id: string; title: string; body: string; createdAt: string }>) {
  vi.mocked(useAnnouncements).mockReturnValue({
    data: items, isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAnnouncements>);
  vi.mocked(useCreateAnnouncement).mockReturnValue({
    mutate, isPending: false,
  } as unknown as ReturnType<typeof useCreateAnnouncement>);
}

describe('AnnouncementsPage', () => {
  beforeEach(() => mutate.mockClear());

  it('shows the empty state and posts a new announcement', () => {
    setup([]);
    render(<AnnouncementsPage />);
    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Office closed Friday' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Enjoy the long weekend.' } });
    fireEvent.click(screen.getByRole('button', { name: /post announcement/i }));
    expect(mutate).toHaveBeenCalledWith(
      { title: 'Office closed Friday', body: 'Enjoy the long weekend.' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('lists existing announcements', () => {
    setup([{ id: 'a1', title: 'Welcome', body: 'Hello team', createdAt: new Date().toISOString() }]);
    render(<AnnouncementsPage />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Hello team')).toBeInTheDocument();
  });
});
