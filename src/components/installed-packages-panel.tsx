import { useState } from 'react';
import { CheckCircle2, Package as PackageIcon, Clock, Ban, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, EmptyState, ErrorState, PageLoadingState } from '@/components/states';
import { StatCard } from '@/components/stat-card';
import { formatDate } from '@/lib/utils';
import { packageCategoryLabel } from '@/lib/packages/category';
import {
  useCompanyPackages,
  useDisablePackage,
  useEnablePackage,
  useUninstallPackage,
  useRestorePackage,
  usePermanentlyRemovePackage,
} from '@/hooks/package-lifecycle';
import {
  availableLifecycleActions,
  lifecycleStatus,
  type CompanyPackageLifecycle,
  type PackageLifecycleStatus,
} from '@/data/package-lifecycle';

const STATUS_TONE: Record<PackageLifecycleStatus, 'healthy' | 'neutral' | 'warning' | 'danger'> = {
  active: 'healthy',
  disabled: 'neutral',
  uninstalled: 'warning',
  removed: 'danger',
};
const STATUS_LABEL: Record<PackageLifecycleStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
  uninstalled: 'Uninstalled',
  removed: 'Removed',
};

/** Company Installed Packages with lifecycle actions gated by role + state. */
export function InstalledPackagesPanel({ isCompanyAdmin }: { isCompanyAdmin: boolean }) {
  const query = useCompanyPackages();
  const disable = useDisablePackage();
  const enable = useEnablePackage();
  const uninstall = useUninstallPackage();
  const restore = useRestorePackage();
  const remove = usePermanentlyRemovePackage();

  // Confirmations: uninstall (data → 30-day retention) and permanent removal
  // (typed confirmation). Both name the exact package to avoid mistakes.
  const [toUninstall, setToUninstall] = useState<CompanyPackageLifecycle | null>(null);
  const [toRemove, setToRemove] = useState<CompanyPackageLifecycle | null>(null);
  const [confirmText, setConfirmText] = useState('');

  if (query.isPending) return <PageLoadingState label="Loading installed packages…" />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const packages = query.data ?? [];
  if (packages.length === 0) {
    return <EmptyState title="No packages installed" description="Installed packages will appear here once a release reaches this company." />;
  }

  const active = packages.filter((p) => lifecycleStatus(p) === 'active').length;
  const retained = packages.filter((p) => lifecycleStatus(p) === 'uninstalled').length;
  const removeKeyword = toRemove ? `DELETE ${toRemove.name.toUpperCase()}` : '';

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Installed packages" value={packages.length} icon={<PackageIcon className="size-5" />} accent="portal" />
        <StatCard label="Active" value={active} hint="Enabled in this workspace" icon={<CheckCircle2 className="size-5" />} />
        <StatCard label="In retention" value={retained} hint="Uninstalled, restorable" icon={<Clock className="size-5" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((p) => {
          const status = lifecycleStatus(p);
          const actions = availableLifecycleActions(p, isCompanyAdmin);
          const busy = [disable, enable, uninstall, restore, remove].some(
            (m) => m.isPending && m.variables?.packageKey === p.packageKey,
          );
          return (
            <Card key={p.packageKey}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate">{p.name}</CardTitle>
                  <p className="mt-1 text-label-caps uppercase text-content-variant">{packageCategoryLabel(p.category)}</p>
                </div>
                <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-content-variant">
                  <Badge tone="neutral">v{p.installedVersion ?? '—'}</Badge>
                  {p.isMandatory && <Badge tone="platform">Mandatory</Badge>}
                  {status === 'uninstalled' && p.retentionUntil && (
                    <span className="flex items-center gap-1 text-status-degraded">
                      <Clock className="size-3.5" /> Retention ends {formatDate(p.retentionUntil)}
                    </span>
                  )}
                </div>

                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {actions.includes('enable') && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => enable.mutate({ packageKey: p.packageKey })}>
                        Re-enable
                      </Button>
                    )}
                    {actions.includes('disable') && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => disable.mutate({ packageKey: p.packageKey })}>
                        <Ban className="size-4" /> Disable
                      </Button>
                    )}
                    {actions.includes('uninstall') && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setToUninstall(p)}>
                        Uninstall
                      </Button>
                    )}
                    {actions.includes('restore') && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => restore.mutate({ packageKey: p.packageKey })}>
                        Restore
                      </Button>
                    )}
                    {actions.includes('permanently_remove') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        disabled={busy}
                        onClick={() => {
                          setConfirmText('');
                          setToRemove(p);
                        }}
                      >
                        <Trash2 className="size-4" /> Permanently Remove
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Uninstall → 30-day retention */}
      <ConfirmDialog
        open={!!toUninstall}
        title={toUninstall ? `Uninstall ${toUninstall.name}?` : ''}
        tone="danger"
        confirmLabel="Uninstall"
        pending={uninstall.isPending}
        description={
          toUninstall?.hasFeatureData
            ? 'The package will be removed from this workspace. Its data is retained for 30 days — you can restore it, or permanently remove it, during that window.'
            : 'The package will be removed from this workspace. You can reinstall it later from the Marketplace.'
        }
        onCancel={() => setToUninstall(null)}
        onConfirm={() =>
          toUninstall &&
          uninstall.mutate(
            { packageKey: toUninstall.packageKey },
            { onSuccess: () => setToUninstall(null), onError: () => setToUninstall(null) },
          )
        }
      />

      {/* Permanent removal → typed confirmation */}
      <ConfirmDialog
        open={!!toRemove}
        title={toRemove ? `Permanently remove ${toRemove.name} data?` : ''}
        tone="danger"
        confirmLabel="Permanently Remove"
        pending={remove.isPending}
        description={
          <div className="space-y-3">
            <p>
              All retained {toRemove?.name} data belonging to this company will be deleted. This cannot be undone.
              Unrelated company data, audit history, and installation history are preserved.
            </p>
            <p>
              Type <span className="font-mono font-semibold text-content">{removeKeyword}</span> to confirm.
            </p>
            <Input
              aria-label="Type the confirmation phrase"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={removeKeyword}
            />
            {confirmText.length > 0 && confirmText !== removeKeyword && (
              <p className="text-xs text-danger">The phrase does not match yet.</p>
            )}
          </div>
        }
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          if (!toRemove || confirmText !== removeKeyword) return;
          remove.mutate(
            { packageKey: toRemove.packageKey },
            { onSuccess: () => setToRemove(null), onError: () => setToRemove(null) },
          );
        }}
      />
    </>
  );
}
