import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PackageReviewDialog } from './package-review-dialog';
import type { PackageImpactManifest } from '@/lib/packages/impact';

const manifest = (over: Partial<PackageImpactManifest> = {}): PackageImpactManifest => ({
  version: '1.0.0',
  releaseNotes: 'Notes here',
  frontend: { navigationItemsAdded: ['Document Notes'] },
  backend: { tablesAdded: ['document_notes'] },
  data: { notes: ['Creates company-owned note records'] },
  dependencies: { minimumPlatformVersion: 'v0.1.0' },
  migrations: { required: true, reversible: true },
  rollback: { supported: false },
  retention: { policy: 'retain_then_purge', retentionDays: 30 },
  diagnostics: { status: 'PASS', checks: [{ label: 'RLS', status: 'PASS' }] },
  ...over,
});

describe('PackageReviewDialog', () => {
  it('renders the impact sections and confirms when diagnostics PASS', () => {
    const onConfirm = vi.fn();
    render(
      <PackageReviewDialog open mode="install" packageName="Document Notes" category="marketplace_extension"
        manifest={manifest()} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('Frontend changes')).toBeInTheDocument();
    expect(screen.getByText('Backend changes')).toBeInTheDocument();
    expect(screen.getByText(/Diagnostics: PASS/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('blocks confirmation when diagnostics are not PASS', () => {
    const onConfirm = vi.fn();
    render(
      <PackageReviewDialog open mode="install" packageName="Bad Pkg" category="marketplace_extension"
        manifest={manifest({ diagnostics: { status: 'FAIL' } })} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled();
    expect(screen.getByText(/has not passed diagnostics/)).toBeInTheDocument();
  });

  it('requires acknowledgement for a breaking change before confirming', () => {
    const onConfirm = vi.fn();
    render(
      <PackageReviewDialog open mode="update" packageName="Doc Notes" category="marketplace_extension"
        currentVersion="1.0.0" targetVersion="2.0.0"
        manifest={manifest({ breaking: true, version: '2.0.0' })} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    const confirm = screen.getByRole('button', { name: 'Update' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();
  });
});
