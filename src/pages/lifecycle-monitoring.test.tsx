// ---------------------------------------------------------------------------
// Lifecycle Monitoring page states.
//
// Production showed "Couldn't load records" for a genuinely failed request —
// which was correct behaviour for a 400. These tests pin the distinction so a
// future change cannot blur an empty log into an error (or hide a real failure
// behind an empty state), and prove Retry refetches only this query.
// ---------------------------------------------------------------------------
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/package-lifecycle', async (orig) => ({
  ...(await orig<typeof import('@/hooks/package-lifecycle')>()),
  useLifecycleOperations: vi.fn(),
}));

import { LifecycleMonitoringPage } from './admin';
import { useLifecycleOperations } from '@/hooks/package-lifecycle';
import type { LifecycleOperationRecord } from '@/data/package-lifecycle/types';

const op = (over: Partial<LifecycleOperationRecord> = {}): LifecycleOperationRecord => ({
  id: 'op-1',
  companyName: 'Alpha Trading',
  packageKey: 'document-notes',
  packageName: 'Document Notes',
  operation: 'install',
  status: 'completed',
  sourceVersion: null,
  targetVersion: '1.0.0',
  diagnosticsStatus: 'PASS',
  correlationId: 'corr-1',
  failureReason: null,
  startedAt: '2026-07-28T10:00:00.000Z',
  completedAt: '2026-07-28T10:00:05.000Z',
  ...over,
});

type Query = ReturnType<typeof useLifecycleOperations>;

function setup(state: Partial<Query>) {
  const refetch = vi.fn();
  vi.mocked(useLifecycleOperations).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch,
    ...state,
  } as unknown as Query);
  return { refetch, ...render(<LifecycleMonitoringPage />) };
}

describe('Lifecycle Monitoring page states', () => {
  it('renders the empty state — not an error — when the log is genuinely empty', () => {
    setup({ data: [] });

    expect(screen.getByText('No lifecycle operations yet')).toBeInTheDocument();
    expect(screen.queryByText(/Couldn’t load records/)).toBeNull();
  });

  it('renders the error state when the request actually fails', () => {
    setup({ isError: true });

    expect(screen.getByText(/Couldn’t load records/)).toBeInTheDocument();
    expect(screen.queryByText('No lifecycle operations yet')).toBeNull();
  });

  it('Retry refetches the lifecycle query', () => {
    const { refetch } = setup({ isError: true });

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders operations with a readable label instead of the raw enum', () => {
    setup({ data: [op({ operation: 'permanent_removal' })] });

    expect(screen.getByText('Alpha Trading')).toBeInTheDocument();
    expect(screen.getByText('Document Notes')).toBeInTheDocument();
    // The database enum is `permanent_removal`; the UI must not show it raw.
    expect(screen.queryByText('permanent_removal')).toBeNull();
  });

  it('exposes exactly the monitoring columns — no tenant feature content', () => {
    setup({ data: [op()] });

    // Pinning the column set is the meaningful guard: adding a feature-data
    // column to this table would have to change this list first.
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Company', 'Package', 'Operation', 'Version', 'Diagnostics', 'Status', 'Started']);
  });
});
