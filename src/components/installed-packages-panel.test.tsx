import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mutate = vi.fn();
const makeMutation = () => ({ mutate, isPending: false, variables: undefined });

vi.mock('@/hooks/package-lifecycle', () => ({
  useCompanyPackages: vi.fn(),
  useDisablePackage: () => makeMutation(),
  useEnablePackage: () => makeMutation(),
  useUninstallPackage: () => makeMutation(),
  useRestorePackage: () => makeMutation(),
  usePermanentlyRemovePackage: () => makeMutation(),
}));

import { InstalledPackagesPanel } from './installed-packages-panel';
import { useCompanyPackages } from '@/hooks/package-lifecycle';
import type { CompanyPackageLifecycle } from '@/data/package-lifecycle';

const row = (over: Partial<CompanyPackageLifecycle>): CompanyPackageLifecycle => ({
  packageKey: 'document-notes',
  name: 'Document Notes',
  category: 'marketplace_extension',
  installedVersion: '1.0.0',
  enabled: true,
  dataState: 'active',
  retentionUntil: null,
  isMandatory: false,
  installationSource: 'company_marketplace',
  hasFeatureData: true,
  featureStatus: 'implemented',
  ...over,
});

const list = (data: CompanyPackageLifecycle[]) =>
  vi.mocked(useCompanyPackages).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCompanyPackages>);

describe('InstalledPackagesPanel', () => {
  beforeEach(() => mutate.mockClear());

  it('shows only valid actions for an active extension and a mandatory package', () => {
    list([
      row({}),
      row({ packageKey: 'hr-core', name: 'HR Core', category: 'standard_package', isMandatory: true, hasFeatureData: false }),
    ]);
    render(<InstalledPackagesPanel isCompanyAdmin />);
    expect(screen.getByRole('button', { name: 'Uninstall' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disable/ })).toBeInTheDocument();
    // Exactly one Uninstall button — HR Core (mandatory) offers none.
    expect(screen.getAllByRole('button', { name: 'Uninstall' })).toHaveLength(1);
  });

  it('shows Restore + Permanently Remove while retained', () => {
    list([row({ enabled: false, dataState: 'retained', retentionUntil: new Date(Date.now() + 8.64e7).toISOString() })]);
    render(<InstalledPackagesPanel isCompanyAdmin />);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Permanently Remove/ })).toBeInTheDocument();
    expect(screen.getByText(/Retention ends/)).toBeInTheDocument();
  });

  it('requires the typed phrase before permanent removal fires', () => {
    list([row({ enabled: false, dataState: 'retained', retentionUntil: new Date(Date.now() + 8.64e7).toISOString() })]);
    render(<InstalledPackagesPanel isCompanyAdmin />);
    // Open the dialog from the card button (the only one before opening).
    fireEvent.click(screen.getByRole('button', { name: /Permanently Remove/ }));
    // The dialog's confirm button is the last one in the DOM (portal to body).
    const confirmBtn = () => screen.getAllByRole('button', { name: /Permanently Remove/ }).at(-1)!;
    // Confirm without typing → no mutation.
    fireEvent.click(confirmBtn());
    expect(mutate).not.toHaveBeenCalled();
    // Type the exact phrase, then confirm → mutation fires.
    fireEvent.change(screen.getByLabelText('Type the confirmation phrase'), { target: { value: 'DELETE DOCUMENT NOTES' } });
    fireEvent.click(confirmBtn());
    expect(mutate).toHaveBeenCalledWith(
      { packageKey: 'document-notes' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('marks a catalog-only package as feature-implementation pending', () => {
    list([row({ packageKey: 'company-announcements', name: 'Company Announcements', featureStatus: 'catalog_only' })]);
    render(<InstalledPackagesPanel isCompanyAdmin />);
    expect(screen.getByText('Feature implementation pending')).toBeInTheDocument();
  });

  it('gives a non-admin no lifecycle action buttons', () => {
    list([row({})]);
    render(<InstalledPackagesPanel isCompanyAdmin={false} />);
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Disable/ })).toBeNull();
  });
});
