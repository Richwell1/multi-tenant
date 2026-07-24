import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RetryAction } from './retry-action';

export type InstallationPhase =
  | 'available'
  | 'pending_confirmation'
  | 'installing'
  | 'installed'
  | 'failed';

export function InstallationProgress({ packageName, step }: { packageName: string; step?: string }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center" role="status" aria-busy="true">
      <Loader2 className="size-10 animate-spin text-[var(--portal-color,#005338)]" />
      <p className="mt-3 text-base font-semibold text-content">Installing {packageName}…</p>
      <p className="mt-1 text-sm text-content-variant">{step ?? 'Applying package changes. Do not close this window.'}</p>
      <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-pill bg-surface-subtle">
        <div className="h-full w-1/2 animate-pulse rounded-pill bg-[var(--portal-color,#005338)]" />
      </div>
    </Card>
  );
}

export function InstallationSuccess({
  packageName,
  onDone,
}: {
  packageName: string;
  onDone?: () => void;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <CheckCircle2 className="size-10 text-status-healthy" />
      <p className="mt-3 text-base font-semibold text-content">{packageName} installed</p>
      <p className="mt-1 text-sm text-content-variant">The package is now active in this workspace.</p>
      {onDone && (
        <Button className="mt-5" variant="secondary" onClick={onDone}>
          Done
        </Button>
      )}
    </Card>
  );
}

export function InstallationFailure({
  packageName,
  reason = 'The installation could not be completed.',
  onRetry,
  retrying,
}: {
  packageName: string;
  reason?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <XCircle className="size-10 text-danger" />
      <p className="mt-3 text-base font-semibold text-content">{packageName} failed to install</p>
      <p className="mt-1 max-w-md text-sm text-content-variant">{reason}</p>
      <div className="mt-5">
        <RetryAction onRetry={onRetry} pending={retrying} label="Retry installation" />
      </div>
    </Card>
  );
}
