import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  PackageUnavailableState,
  InstallationFailure,
} from './index';

describe('UI-state components', () => {
  it('EmptyState renders title and description', () => {
    render(<EmptyState title="No employees yet" description="Add one to start." />);
    expect(screen.getByText('No employees yet')).toBeInTheDocument();
    expect(screen.getByText('Add one to start.')).toBeInTheDocument();
  });

  it('NoResultsState echoes the query', () => {
    render(<NoResultsState query="acme" />);
    expect(screen.getByText(/acme/)).toBeInTheDocument();
  });

  it('ErrorState retry button invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('PackageUnavailableState names the package (gating message)', () => {
    render(<PackageUnavailableState packageName="Leave Management" />);
    expect(screen.getByText('Package not enabled')).toBeInTheDocument();
    expect(screen.getByText(/Leave Management is not enabled for this company/i)).toBeInTheDocument();
  });

  it('InstallationFailure exposes a retry action', () => {
    const onRetry = vi.fn();
    render(<InstallationFailure packageName="Attendance" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry installation/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
