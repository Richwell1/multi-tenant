import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PackageGuard } from './package-guard';
import { useCompanyContext } from '@/hooks/context';

vi.mock('@/hooks/context', () => ({ useCompanyContext: vi.fn() }));
const mockCtx = vi.mocked(useCompanyContext);

// Only the shape PackageGuard reads is relevant.
const ctxResult = (value: unknown) => mockCtx.mockReturnValue(value as ReturnType<typeof useCompanyContext>);

describe('PackageGuard', () => {
  it('renders children when the company is entitled', () => {
    ctxResult({ data: { enabledPackageCodes: ['hr-core', 'leave-management'] }, isPending: false, isError: false });
    render(
      <PackageGuard packageCode="leave-management" packageName="Leave Management">
        <div>LEAVE CONTENT</div>
      </PackageGuard>,
    );
    expect(screen.getByText('LEAVE CONTENT')).toBeInTheDocument();
  });

  it('renders the package-unavailable state when not entitled', () => {
    ctxResult({ data: { enabledPackageCodes: ['hr-core'] }, isPending: false, isError: false });
    render(
      <PackageGuard packageCode="leave-management" packageName="Leave Management">
        <div>LEAVE CONTENT</div>
      </PackageGuard>,
    );
    expect(screen.queryByText('LEAVE CONTENT')).toBeNull();
    expect(screen.getByText('Package not enabled')).toBeInTheDocument();
    expect(screen.getByText(/Leave Management is not enabled/i)).toBeInTheDocument();
  });

  it('shows a loading state while entitlements resolve', () => {
    ctxResult({ data: undefined, isPending: true, isError: false });
    render(
      <PackageGuard packageCode="attendance-management" packageName="Attendance">
        <div>ATT CONTENT</div>
      </PackageGuard>,
    );
    expect(screen.queryByText('ATT CONTENT')).toBeNull();
  });
});
