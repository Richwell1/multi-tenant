import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { emptyCompanyTarget, type CompanyTargetMode, type CompanyTargetValue } from '@/lib/company-target';
import { CompanyTargetSelector } from './company-target-selector';

const COMPANIES = [
  { id: 'alpha', name: 'Alpha Trading', status: 'active' },
  { id: 'beta', name: 'Beta Manufacturing', status: 'active' },
  { id: 'gamma', name: 'Gamma Logistics', status: 'active' },
];

function makeClient(companies: unknown[] = COMPANIES) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(queryKeys.companies.list({ status: 'active' }), companies);
  qc.setQueryData(queryKeys.companies.list(), companies);
  return qc;
}

function Harness({
  allowedModes,
  initial,
}: {
  allowedModes?: CompanyTargetMode[];
  initial?: CompanyTargetValue;
}) {
  const [value, setValue] = useState<CompanyTargetValue>(initial ?? emptyCompanyTarget('selected_companies'));
  return (
    <CompanyTargetSelector value={value} onChange={setValue} allowedModes={allowedModes} />
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}, companies?: unknown[]) {
  const qc = makeClient(companies);
  return render(
    <QueryClientProvider client={qc}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /select companies/i }));

describe('CompanyTargetSelector', () => {
  it('renders all three modes by default', () => {
    renderHarness();
    expect(screen.getByRole('radio', { name: 'All companies' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Selected companies' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'One company' })).toBeInTheDocument();
  });

  it('restricts the offered modes via allowedModes', () => {
    renderHarness({ allowedModes: ['selected_companies', 'all_companies'] });
    expect(screen.getByRole('radio', { name: 'Selected companies' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All companies' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'One company' })).toBeNull();
  });

  it('switching to All companies clears the selection', () => {
    renderHarness({ initial: { mode: 'selected_companies', companyIds: ['alpha', 'beta'] } });
    // chips present initially
    expect(screen.getByRole('button', { name: 'Remove Alpha Trading' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'All companies' }));
    expect(screen.getByText(/all active companies/i)).toBeInTheDocument();
    // back to selected → nothing retained
    fireEvent.click(screen.getByRole('radio', { name: 'Selected companies' }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('multi-select updates the selected count and prevents duplicates', () => {
    renderHarness();
    openPanel();
    fireEvent.click(screen.getByRole('option', { name: 'Alpha Trading' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Beta Manufacturing' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    // clicking Alpha again toggles it off (no duplicate accumulation)
    fireEvent.click(screen.getByRole('option', { name: 'Alpha Trading' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('preserves selections while searching', () => {
    renderHarness();
    openPanel();
    fireEvent.click(screen.getByRole('option', { name: 'Alpha Trading' }));
    const search = screen.getByRole('combobox', { name: /search companies/i });
    fireEvent.change(search, { target: { value: 'beta' } });
    // Alpha is filtered out of the list but remains selected (chip persists)
    expect(screen.queryByRole('option', { name: 'Alpha Trading' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Alpha Trading' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('select all visible affects only the filtered results', () => {
    renderHarness();
    openPanel();
    fireEvent.change(screen.getByRole('combobox', { name: /search companies/i }), {
      target: { value: 'Trad' },
    });
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(1); // only Alpha Trading
    fireEvent.click(screen.getByRole('button', { name: /select all visible/i }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('clear all empties the selection', () => {
    renderHarness({ initial: { mode: 'selected_companies', companyIds: ['alpha', 'beta'] } });
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('renders an empty state when there are no companies', () => {
    renderHarness({}, []);
    expect(screen.getByText('No companies')).toBeInTheDocument();
  });
});
