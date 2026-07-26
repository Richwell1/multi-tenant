import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('renders label, value, hint, and an optional icon', () => {
    render(<StatCard label="Total Companies" value={12} hint="Auto-assigned" icon={<span data-testid="stat-icon">i</span>} />);
    expect(screen.getByText('Total Companies')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Auto-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('uses tabular numerals for the value', () => {
    render(<StatCard label="Active" value={7} />);
    expect(screen.getByText('7').className).toContain('tabular-nums');
  });
});
