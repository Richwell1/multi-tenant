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
vi.mock('@/hooks/pulse-surveys', () => ({ usePulseSurveys: vi.fn(), useCreatePulseSurvey: vi.fn() }));
vi.mock('@/hooks/use-company-id', () => ({ useCompanyId: () => 'alpha' }));

import { PulseSurveysPage } from './workspace';
import { usePulseSurveys, useCreatePulseSurvey } from '@/hooks/pulse-surveys';

const mutate = vi.fn();
function setup(items: Array<{ id: string; question: string; description: string; status: string; createdAt: string }>) {
  vi.mocked(usePulseSurveys).mockReturnValue({
    data: items, isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof usePulseSurveys>);
  vi.mocked(useCreatePulseSurvey).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCreatePulseSurvey>);
}

describe('PulseSurveysPage', () => {
  beforeEach(() => mutate.mockClear());

  it('shows the empty state and creates a survey', () => {
    setup([]);
    render(<PulseSurveysPage />);
    expect(screen.getByText('No surveys yet')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'How are you this week?' } });
    fireEvent.click(screen.getByRole('button', { name: /create survey/i }));
    expect(mutate).toHaveBeenCalledWith(
      { question: 'How are you this week?', description: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('lists surveys with their status', () => {
    setup([{ id: 's1', question: 'Team morale?', description: '', status: 'active', createdAt: new Date().toISOString() }]);
    render(<PulseSurveysPage />);
    expect(screen.getByText('Team morale?')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
