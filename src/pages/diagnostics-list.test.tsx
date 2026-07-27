import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/hooks/diagnostics', () => ({ useDiagnostics: vi.fn(), useDiagnostic: vi.fn() }));

import { DiagnosticsList } from './admin';
import { useDiagnostics } from '@/hooks/diagnostics';
import type { DiagnosticCheck } from '@/data/diagnostics';

const checks = (pass: number, warn = 0): DiagnosticCheck[] => [
  ...Array.from({ length: pass }, () => ({ dimension: 'frontend', status: 'PASS', required: true, detail: '' })),
  ...Array.from({ length: warn }, () => ({ dimension: 'backend', status: 'WARN', required: false, detail: '' })),
] as DiagnosticCheck[];

describe('DiagnosticsList', () => {
  it('shows the passed / total checks count and the result', () => {
    vi.mocked(useDiagnostics).mockReturnValue({
      data: [{ id: 'd1', packageKey: 'hr-core', result: 'WARN', recommendation: 'Review', checks: checks(7, 1) }],
      isPending: false, isError: false, isFetching: false,
    } as ReturnType<typeof useDiagnostics>);
    render(<DiagnosticsList />);
    expect(screen.getByText('7 / 8 passed')).toBeInTheDocument();
    expect(screen.getByText('WARN')).toBeInTheDocument();
  });
});
