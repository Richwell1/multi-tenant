import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { packageCategoryLabel, type PackageCategory } from '@/lib/packages/category';
import type { PackageImpactManifest } from '@/lib/packages/impact';
import type { DiagnosticResult } from '@/data/types';

type ReviewMode = 'install' | 'update' | 'rollback';

interface Props {
  open: boolean;
  mode: ReviewMode;
  packageName: string;
  category: PackageCategory;
  manifest: PackageImpactManifest;
  currentVersion?: string | null;
  targetVersion?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MODE_TITLE: Record<ReviewMode, string> = { install: 'Review install', update: 'Review update', rollback: 'Review rollback' };
const MODE_CONFIRM: Record<ReviewMode, string> = { install: 'Install', update: 'Update', rollback: 'Roll back' };

function diagIcon(status: DiagnosticResult) {
  if (status === 'PASS') return <CheckCircle2 className="size-4 text-status-healthy" aria-hidden />;
  if (status === 'WARN') return <AlertTriangle className="size-4 text-status-degraded" aria-hidden />;
  return <XCircle className="size-4 text-danger" aria-hidden />;
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-label-caps uppercase text-content-variant">{title}</p>
      <ul className="mt-1 space-y-1 text-sm text-content">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-content-variant">•</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Accessible review dialog shown BEFORE install/update/rollback. Renders the
 * structured impact manifest by section, blocks confirmation unless diagnostics
 * PASS, and requires explicit acknowledgement for breaking / irreversible change.
 */
export function PackageReviewDialog({
  open, mode, packageName, category, manifest, currentVersion, targetVersion, pending, onConfirm, onCancel,
}: Props) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const [ack, setAck] = useState(false);

  // Reset the acknowledgement whenever a new review opens.
  useEffect(() => { if (open) setAck(false); }, [open, packageName, targetVersion]);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onCancelRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  if (!open) return null;

  const irreversible = mode === 'update' && manifest.migrations.required && !manifest.migrations.reversible;
  const needsAck = !!manifest.breaking || irreversible;
  const diagnosticsPass = manifest.diagnostics.status === 'PASS';
  const confirmDisabled = pending || !diagnosticsPass || (needsAck && !ack);

  const compatibility: string[] = [
    manifest.dependencies.minimumPlatformVersion ? `Minimum platform ${manifest.dependencies.minimumPlatformVersion}` : '',
    manifest.dependencies.basePackageKey
      ? `Requires ${manifest.dependencies.basePackageKey}${manifest.dependencies.minimumBasePackageVersion ? ` ≥ ${manifest.dependencies.minimumBasePackageVersion}` : ''}`
      : 'No base-package dependency',
    ...(manifest.dependencies.incompatiblePackageKeys ?? []).map((k) => `Incompatible with ${k}`),
  ].filter(Boolean);

  const rollback: string[] = [
    `Supported: ${manifest.rollback.supported ? 'Yes' : 'No'}`,
    ...(manifest.rollback.eligibleTargetVersions?.length ? [`Eligible target: ${manifest.rollback.eligibleTargetVersions.join(', ')}`] : []),
    ...(manifest.rollback.limitations ?? []),
    manifest.retention.policy === 'retain_then_purge'
      ? `Uninstall retains data for ${manifest.retention.retentionDays} days`
      : 'Data is preserved on uninstall',
  ];

  const modal: ReactNode = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-content/40 p-4"
         role="dialog" aria-modal="true" aria-labelledby={titleId}
         onClick={() => !pending && onCancelRef.current()}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl sm:p-6"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <p className="text-label-caps uppercase text-[var(--portal-color)]">{MODE_TITLE[mode]}</p>
          <h2 id={titleId} className="mt-1 text-xl font-bold text-content">{packageName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="company">{packageCategoryLabel(category)}</Badge>
            {mode === 'install' ? (
              <Badge tone="neutral">Version {manifest.version}</Badge>
            ) : (
              <Badge tone="neutral">{currentVersion ?? '—'} → {targetVersion ?? manifest.version}</Badge>
            )}
          </div>
        </div>

        {/* Diagnostics gate */}
        <div className="mb-4 rounded-md border border-border bg-surface-subtle p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-content">
            {diagIcon(manifest.diagnostics.status)} Diagnostics: {manifest.diagnostics.status}
          </div>
          {manifest.diagnostics.checks && (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {manifest.diagnostics.checks.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5 text-xs text-content-variant">
                  {diagIcon(c.status)} {c.label}
                </li>
              ))}
            </ul>
          )}
          {!diagnosticsPass && (
            <p className="mt-2 text-xs text-danger">This version has not passed diagnostics and cannot be applied.</p>
          )}
        </div>

        <div className="space-y-4">
          {manifest.releaseNotes && (
            <p className="text-sm text-content-variant">{manifest.releaseNotes}</p>
          )}
          <Section title="Frontend changes" items={[...(manifest.frontend.routesAdded ?? []), ...(manifest.frontend.navigationItemsAdded ?? []), ...(manifest.frontend.formsChanged ?? []), ...(manifest.frontend.componentsChanged ?? [])]} />
          <Section title="Backend changes" items={[...(manifest.backend.tablesAdded ?? []), ...(manifest.backend.tablesChanged ?? []), ...(manifest.backend.rpcsAdded ?? []), ...(manifest.backend.policiesChanged ?? []), ...(manifest.backend.grantsChanged ?? [])]} />
          <Section title="Data impact" items={manifest.data.notes} />
          <Section title="Compatibility" items={compatibility} />
          <Section title="Rollback & retention" items={rollback} />
        </div>

        {needsAck && (
          <label className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-content">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            <span>
              I understand this {manifest.breaking ? 'is a breaking change' : 'includes an irreversible migration'} and
              want to proceed.
            </span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>
          <Button onClick={onConfirm} disabled={confirmDisabled}>
            {pending && <Loader2 className="animate-spin" />}
            {MODE_CONFIRM[mode]}
          </Button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
