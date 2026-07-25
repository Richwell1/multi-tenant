import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { DataTable, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { TableBoundary, RefreshingIndicator } from '@/components/table-boundary';
import { PageLoadingState, ErrorState, EmptyState, ConfirmDialog } from '@/components/states';
import { CompanyTargetSelector } from '@/components/company-target';
import { formatDate } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { useCompanies, useCompany } from '@/hooks/queries';
import { useUsage } from '@/hooks/usage';
import { useAudit } from '@/hooks/audit';
import { useHealth } from '@/hooks/health';
import { useDiagnostic } from '@/hooks/diagnostics';
import { DIAGNOSTIC_DIMENSIONS, type DiagnosticCheck } from '@/data/diagnostics';
import {
  useCompanyAssignments,
  useInstallationsMonitor,
  usePackage,
  usePackages,
  usePackageVersions,
  usePublishRelease,
  useRetryInstallation,
  useRollbackInstallation,
} from '@/hooks/packages';
import { useRequests, useRequest, useCreateRequest, useChangeRequestStatus } from '@/hooks/requests';
import { requestFormSchema, type RequestFormValues } from '@/services/request-service';
import { allowedNextStatuses } from '@/data/requests';
import { RepositoryError } from '@/data/errors';
import {
  canRetryInstallation,
  canRollbackInstallation,
  type PackageInstallation,
  type PackageInstallationStatus,
} from '@/data/packages';
import {
  emptyCompanyTarget,
  createCompanyTargetSchema,
  type CompanyTargetValue,
} from '@/lib/company-target';
import { allowedTargetModesForPackageType, allowedTargetModesForExtension, type ExtensionNature } from '@/lib/package-target';
import type { CompanyStatus, DiagnosticResult, PackageType, RequestStatus } from '@/data/types';

/** Shared page-level company-target filter used by monitoring/analytics pages. */
function TargetFilter({
  value,
  onChange,
}: {
  value: CompanyTargetValue;
  onChange: (v: CompanyTargetValue) => void;
}) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <CompanyTargetSelector
          value={value}
          onChange={onChange}
          label="Filter by companies"
          description="Scope this view to all, selected, or one company."
          minimumSelectedCompanies={2}
        />
      </CardContent>
    </Card>
  );
}

const companyTone = (s: CompanyStatus) => (s === 'active' ? 'healthy' : 'suspended');
const diagTone = (r: DiagnosticResult) =>
  r === 'PASS' ? 'healthy' : r === 'WARN' ? 'degraded' : 'offline';
const installTone = (s: PackageInstallationStatus) =>
  s === 'installed' ? 'healthy' : s === 'failed' ? 'offline' : s === 'rolled_back' ? 'neutral' : 'degraded';
const requestTone = (s: RequestStatus) =>
  s === 'released' || s === 'installed' || s === 'closed'
    ? 'healthy'
    : s === 'rejected'
      ? 'offline'
      : 'platform';


function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full max-w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-variant" />
      <Input
        className="pl-9"
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search"
      />
    </div>
  );
}

// --- Dashboard ----------------------------------------------------------------

export function AdminDashboard() {
  const companies = useCompanies();
  const health = useHealth();
  const audit = useAudit(emptyCompanyTarget('all_companies'));

  if (companies.isPending) return <PageLoadingState label="Loading platform overview…" />;
  if (companies.isError)
    return <ErrorState onRetry={() => companies.refetch()} retrying={companies.isFetching} />;

  const active = companies.data.filter((c) => c.status === 'active').length;
  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        description="Multi-Tenants HR — system overview"
        actions={<RefreshingIndicator show={companies.isFetching} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Companies" value={companies.data.length} />
        <StatCard label="Active Companies" value={active} />
        <StatCard label="Using HR Core" value={companies.data.length} hint="Auto-assigned" />
        <StatCard label="Most-used Module" value="Employees" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {audit.data?.slice(0, 3).map((a) => (
              <div key={a.id} className="flex justify-between">
                <span className="text-content">{a.action}</span>
                <span className="text-content-variant">{a.target}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {health.data?.map((h) => (
              <div key={h.label} className="flex items-center justify-between">
                <span className="text-content-variant">{h.label}</span>
                <Badge tone={h.status}>{h.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Companies ----------------------------------------------------------------

export function CompaniesList() {
  const [q, setQ] = useState('');
  const query = useCompanies();
  const filtered = (query.data ?? []).filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Companies"
        description="All registered tenant companies"
        actions={
          <>
            <RefreshingIndicator show={query.isFetching && !query.isPending} />
            <SearchBar value={q} onChange={setQ} />
          </>
        }
      />
      <TableBoundary query={query} filtered={filtered} searchTerm={q} cols={6}>
        <DataTable>
          <THead>
            <TH>Company</TH>
            <TH>Subdomain</TH>
            <TH>Employees</TH>
            <TH>Packages</TH>
            <TH>Status</TH>
            <TH>Registered</TH>
          </THead>
          <TBody>
            {filtered.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link
                    to="/admin/companies/$companyId"
                    params={{ companyId: c.id }}
                    className="font-medium text-platform hover:underline"
                  >
                    {c.name}
                  </Link>
                </TD>
                <TD className="text-content-variant">{c.subdomain}</TD>
                <TD>{c.employeeCount}</TD>
                <TD>{c.packages.length}</TD>
                <TD>
                  <Badge tone={companyTone(c.status)}>{c.status}</Badge>
                </TD>
                <TD className="text-content-variant">{formatDate(c.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function CompanyDetails() {
  const { companyId } = useParams({ strict: false });
  const cid = companyId as string;
  const query = useCompany(cid);
  const assignments = useCompanyAssignments(cid);
  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const company = query.data;
  if (!company) return <EmptyState title="Company not found" description="This company may have been removed." />;
  const rows = assignments.data ?? [];
  return (
    <>
      <PageHeader
        title={company.name}
        description={company.subdomain}
        actions={<Badge tone={companyTone(company.status)}>{company.status}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Employees" value={company.employeeCount} />
        <StatCard label="Slug" value={company.slug} />
        <StatCard label="Admin Email" value={company.adminEmail} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Package Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <TableBoundary query={assignments} filtered={rows} cols={4} emptyTitle="No package assignments">
            <DataTable>
              <THead>
                <TH>Package</TH>
                <TH>Version</TH>
                <TH>Enabled</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {rows.map((a) => (
                  <TR key={a.packageCode}>
                    <TD className="font-medium">{a.packageName}</TD>
                    <TD>{a.version ?? '—'}</TD>
                    <TD>
                      <Badge tone={a.enabled ? 'healthy' : 'neutral'}>{a.enabled ? 'enabled' : 'disabled'}</Badge>
                    </TD>
                    <TD className="text-content-variant">{a.status}</TD>
                  </TR>
                ))}
              </TBody>
            </DataTable>
          </TableBoundary>
        </CardContent>
      </Card>
    </>
  );
}

// --- Requests -----------------------------------------------------------------

export function RequestsList() {
  const [q, setQ] = useState('');
  const query = useRequests();
  const companies = useCompanies();
  const filtered = (query.data ?? []).filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Request Records"
        description="Feature requests received by email, logged manually"
        actions={
          <>
            <SearchBar value={q} onChange={setQ} />
            <Link to="/admin/requests/new">
              <Button>New Request</Button>
            </Link>
          </>
        }
      />
      <TableBoundary query={query} filtered={filtered} searchTerm={q} cols={5}>
        <DataTable>
          <THead>
            <TH>Title</TH>
            <TH>Company</TH>
            <TH>Type</TH>
            <TH>Priority</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link
                    to="/admin/requests/$requestId"
                    params={{ requestId: r.id }}
                    className="font-medium text-platform hover:underline"
                  >
                    {r.title}
                  </Link>
                </TD>
                <TD className="text-content-variant">
                  {companies.data?.find((c) => c.id === r.companyId)?.name ?? r.companyId}
                </TD>
                <TD>{r.requestType}</TD>
                <TD>{r.priority}</TD>
                <TD>
                  <Badge tone={requestTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function CreateRequest() {
  const navigate = useNavigate();
  const companies = useCompanies();
  const mutation = useCreateRequest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: { priority: 'medium' },
  });

  // Linking a request to companies reuses the shared selector; a private
  // extension may target only one company, a shared extension selected/all.
  const [nature, setNature] = useState<ExtensionNature>('private_extension');
  const allowedLinkModes = allowedTargetModesForExtension(nature);
  const [linkTarget, setLinkTarget] = useState<CompanyTargetValue>(emptyCompanyTarget(allowedLinkModes[0]));
  const [linkError, setLinkError] = useState<string | undefined>();
  useEffect(() => {
    setLinkTarget((cur) =>
      allowedLinkModes.includes(cur.mode) ? cur : emptyCompanyTarget(allowedLinkModes[0]),
    );
  }, [allowedLinkModes]);

  const onValid = (values: RequestFormValues) => {
    const parsed = createCompanyTargetSchema({ allowedModes: allowedLinkModes }).safeParse(linkTarget);
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Invalid company target');
      notify.validationFailure();
      return;
    }
    setLinkError(undefined);
    mutation.mutate(values, { onSuccess: () => navigate({ to: '/admin/requests' }) });
  };

  return (
    <>
      <PageHeader title="Create Request Record" description="Log a request received by email" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onValid, () => notify.validationFailure())} className="space-y-4" noValidate>
            <Field label="Company" htmlFor="companyId" error={errors.companyId?.message}>
              <select
                id="companyId"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                {...register('companyId')}
              >
                <option value="">Select…</option>
                {companies.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Request Title" htmlFor="title" error={errors.title?.message}>
              <Input id="title" aria-invalid={!!errors.title} {...register('title')} />
            </Field>
            <Field label="Request Type" htmlFor="requestType" error={errors.requestType?.message}>
              <Input id="requestType" aria-invalid={!!errors.requestType} {...register('requestType')} />
            </Field>
            <Field
              label="Source Email Reference"
              htmlFor="sourceEmailReference"
              error={errors.sourceEmailReference?.message}
            >
              <Input
                id="sourceEmailReference"
                placeholder="EML-2026-0001"
                aria-invalid={!!errors.sourceEmailReference}
                {...register('sourceEmailReference')}
              />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description?.message}>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                {...register('description')}
              />
            </Field>
            <Field label="Priority" htmlFor="priority" error={errors.priority?.message}>
              <select
                id="priority"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                {...register('priority')}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Extension nature" htmlFor="nature">
              <select
                id="nature"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={nature}
                onChange={(e) => setNature(e.target.value as ExtensionNature)}
              >
                <option value="private_extension">Private extension</option>
                <option value="shared_extension">Shared extension</option>
              </select>
            </Field>
            <CompanyTargetSelector
              label="Link package target"
              description={
                nature === 'private_extension'
                  ? 'Private extensions target exactly one company.'
                  : 'Shared extensions target selected companies or all companies.'
              }
              value={linkTarget}
              onChange={setLinkTarget}
              allowedModes={allowedLinkModes}
              error={linkError}
            />
            <div className="flex gap-2">
              <SubmitButton pending={mutation.isPending} pendingLabel="Creating…">
                Create Request
              </SubmitButton>
              <Link to="/admin/requests">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export function RequestDetails() {
  const { requestId } = useParams({ strict: false });
  const query = useRequest(requestId as string);
  const companies = useCompanies();
  const statusMutation = useChangeRequestStatus(requestId as string);
  const [status, setStatus] = useState<RequestStatus | ''>('');

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const request = query.data;
  if (!request) return <EmptyState title="Request not found" />;
  const company = companies.data?.find((c) => c.id === request.companyId);

  return (
    <>
      <PageHeader
        title={request.title}
        description={`${company?.name ?? request.companyId} · ${request.sourceEmailReference}`}
        actions={<Badge tone={requestTone(request.status)}>{request.status.replace(/_/g, ' ')}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <Row label="Type" value={request.requestType} />
            <Row label="Priority" value={request.priority} />
            <Row label="Description" value={request.description} />
            <Row label="Internal Note" value={request.internalNote} />
            <Row label="Linked Package" value={request.linkedPackageKey ?? '—'} />
            <Row
              label="Diagnostic"
              value={
                request.diagnosticId ? (
                  <Link
                    to="/admin/diagnostics/$diagnosticId"
                    params={{ diagnosticId: request.diagnosticId }}
                    className="text-platform hover:underline"
                  >
                    View report
                  </Link>
                ) : (
                  '—'
                )
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Change Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as RequestStatus)}
            >
              <option value="">Select new status…</option>
              {allowedNextStatuses(request.status).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <SubmitButton
              pending={statusMutation.isPending}
              pendingLabel="Updating…"
              disabled={!status}
              onClick={() => status && statusMutation.mutate({ current: request.status, next: status })}
              type="button"
            >
              Update Status
            </SubmitButton>
            {allowedNextStatuses(request.status).length === 0 && (
              <p className="text-xs text-content-variant">This request is in a terminal state.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// --- Packages -----------------------------------------------------------------

export function PackagesList() {
  const [q, setQ] = useState('');
  const query = usePackages();
  const filtered = (query.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Packages"
        description="Standard updates and private customizations"
        actions={
          <>
            <SearchBar value={q} onChange={setQ} />
            <Link to="/admin/packages/new">
              <Button>Create Package Release</Button>
            </Link>
          </>
        }
      />
      <TableBoundary query={query} filtered={filtered} searchTerm={q} cols={3}>
        <DataTable>
          <THead>
            <TH>Package</TH>
            <TH>Classification</TH>
            <TH>Global status</TH>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.code}>
                <TD>
                  <Link
                    to="/admin/packages/$packageId"
                    params={{ packageId: p.code }}
                    className="font-medium text-platform hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="ml-2 text-content-variant">{p.code}</span>
                </TD>
                <TD className="text-content-variant">{p.classification.replace(/_/g, ' ')}</TD>
                <TD>
                  <Badge tone={p.isActive ? 'healthy' : 'neutral'}>{p.isActive ? 'active' : 'inactive'}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function CreatePackage() {
  const navigate = useNavigate();
  const packagesQuery = usePackages();
  const [packageCode, setPackageCode] = useState('');
  const versionsQuery = usePackageVersions(packageCode);
  const [versionId, setVersionId] = useState('');
  const [automaticInstall, setAutomaticInstall] = useState(true);
  const publish = usePublishRelease();

  const selectedPackage = packagesQuery.data?.find((p) => p.code === packageCode);
  const classification: PackageType = selectedPackage?.classification ?? 'standard_update';
  const allowedModes = allowedTargetModesForPackageType(classification);
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget(allowedModes[0]));
  const [error, setError] = useState<string | undefined>();

  // Release gate (fail-fast UX; the publish RPC is authoritative): a version whose
  // diagnostic ended in FAIL cannot be released.
  const selectedVersion = versionsQuery.data?.find((v) => v.id === versionId);
  const gateBlocked = selectedVersion?.diagnosticStatus === 'FAIL';

  // Re-normalize the target when the selected package's classification changes,
  // and reset the version when the package changes (versions are package-scoped).
  useEffect(() => {
    const modes = allowedTargetModesForPackageType(classification);
    setTarget((current) => (modes.includes(current.mode) ? current : emptyCompanyTarget(modes[0])));
  }, [classification]);
  useEffect(() => setVersionId(''), [packageCode]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!packageCode) return setError('Select a package.');
    if (!versionId) return setError('Select a version to publish.');
    if (gateBlocked) return setError('This version has a failing required diagnostic check and cannot be released.');
    publish.mutate(
      { packageVersionId: versionId, classification, target, automaticInstall },
      {
        onSuccess: () => navigate({ to: '/admin/packages' }),
        onError: (err) => {
          const msg = err instanceof RepositoryError ? err.message : 'Publish failed. Please try again.';
          setError(
            msg === 'release_blocked_by_diagnostic'
              ? 'Release blocked: a required diagnostic check is FAIL for this version.'
              : msg,
          );
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Create Package Release" description="Publish a package version to companies" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {error && (
            <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Package">
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={packageCode}
                onChange={(e) => setPackageCode(e.target.value)}
                aria-label="Package"
              >
                <option value="">Select a package…</option>
                {packagesQuery.data?.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.classification.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Version">
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm disabled:opacity-50"
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
                disabled={!packageCode || versionsQuery.isPending}
                aria-label="Version"
              >
                <option value="">Select a version…</option>
                {versionsQuery.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version}
                    {v.diagnosticStatus ? ` — diagnostic ${v.diagnosticStatus}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            {gateBlocked && (
              <p className="text-sm font-medium text-danger">
                This version has a failing required diagnostic check and cannot be released.
              </p>
            )}

            <CompanyTargetSelector
              label="Target"
              description={
                classification === 'private_customization'
                  ? 'Private customizations target exactly one company.'
                  : classification === 'shared_extension'
                    ? 'Shared extensions target selected companies or all companies.'
                    : 'This classification can target all, selected, or one company.'
              }
              value={target}
              onChange={setTarget}
              allowedModes={allowedModes}
            />

            <label className="flex items-center gap-2 text-sm text-content-variant">
              <input type="checkbox" checked={automaticInstall} onChange={(e) => setAutomaticInstall(e.target.checked)} />
              Install automatically on publish
            </label>

            <SubmitButton
              pending={publish.isPending}
              pendingLabel="Publishing…"
              disabled={!packageCode || !versionId || gateBlocked}
            >
              Publish Release
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export function PackageDetails() {
  const { packageId } = useParams({ strict: false });
  const code = packageId as string;
  const query = usePackage(code);
  const versions = usePackageVersions(code);
  const installs = useInstallationsMonitor({ packageCode: code });

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const pkg = query.data;
  if (!pkg) return <EmptyState title="Package not found" />;

  const rows = installs.data ?? [];
  const installed = rows.filter((r) => r.status === 'installed').length;
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'installing').length;
  const failed = rows.filter((r) => r.status === 'failed').length;

  return (
    <>
      <PageHeader
        title={pkg.name}
        description={`${pkg.code} · ${pkg.classification.replace(/_/g, ' ')}`}
        actions={<Badge tone={pkg.isActive ? 'healthy' : 'neutral'}>{pkg.isActive ? 'active' : 'inactive'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Installed" value={installed} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Failed" value={failed} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-content-variant">{pkg.description || '—'}</CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <TableBoundary query={versions} filtered={versions.data ?? []} cols={4} emptyTitle="No versions">
            <DataTable>
              <THead>
                <TH>Version</TH>
                <TH>Released</TH>
                <TH>Diagnostic</TH>
                <TH>Notes</TH>
              </THead>
              <TBody>
                {(versions.data ?? []).map((v) => (
                  <TR key={v.id}>
                    <TD>{v.version}</TD>
                    <TD className="text-content-variant">{v.releasedAt ? formatDate(v.releasedAt) : '—'}</TD>
                    <TD>{v.diagnosticStatus ? <Badge tone={diagTone(v.diagnosticStatus)}>{v.diagnosticStatus}</Badge> : '—'}</TD>
                    <TD className="text-content-variant">{v.releaseNotes}</TD>
                  </TR>
                ))}
              </TBody>
            </DataTable>
          </TableBoundary>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Installations</CardTitle>
        </CardHeader>
        <CardContent>
          <TableBoundary query={installs} filtered={rows} cols={4} emptyTitle="No installations yet">
            <DataTable>
              <THead>
                <TH>Company</TH>
                <TH>Version</TH>
                <TH>Status</TH>
                <TH>Completed</TH>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id}>
                    <TD>{r.companyName}</TD>
                    <TD>{r.version}</TD>
                    <TD>
                      <Badge tone={installTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </TD>
                    <TD className="text-content-variant">{r.completedAt ? formatDate(r.completedAt) : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </DataTable>
          </TableBoundary>
        </CardContent>
      </Card>
    </>
  );
}

const dimensionLabel = (d: DiagnosticCheck['dimension']) =>
  ({
    frontend: 'Frontend impact',
    backend: 'Backend impact',
    database: 'Database impact',
    security: 'Security impact',
    dependency: 'Dependency impact',
    data_impact: 'Data impact',
    rollback: 'Rollback readiness',
    test_evidence: 'Test evidence',
  })[d];

function DiagnosticChecksCard({ checks }: { checks: DiagnosticCheck[] }) {
  // Present the eight dimensions in a stable order even if some are absent.
  const byDimension = new Map(checks.map((c) => [c.dimension, c]));
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Diagnostic Checks</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable>
          <THead>
            <TH>Dimension</TH>
            <TH>Status</TH>
            <TH>Required</TH>
            <TH>Detail</TH>
          </THead>
          <TBody>
            {DIAGNOSTIC_DIMENSIONS.map((d) => {
              const c = byDimension.get(d);
              return (
                <TR key={d}>
                  <TD className="font-medium">{dimensionLabel(d)}</TD>
                  <TD>{c ? <Badge tone={diagTone(c.status)}>{c.status}</Badge> : '—'}</TD>
                  <TD className="text-content-variant">{c ? (c.required ? 'Required' : 'Advisory') : '—'}</TD>
                  <TD className="text-content-variant">{c?.detail || '—'}</TD>
                </TR>
              );
            })}
          </TBody>
        </DataTable>
      </CardContent>
    </Card>
  );
}

export function DiagnosticReportPage() {
  const { diagnosticId } = useParams({ strict: false });
  const query = useDiagnostic(diagnosticId as string);
  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const diag = query.data;
  if (!diag) return <EmptyState title="Diagnostic not found" />;
  const blocked = diag.checks.some((c) => c.required && c.status === 'FAIL');
  return (
    <>
      <PageHeader
        title="Diagnostic Report"
        description={diag.packageKey}
        actions={<Badge tone={diagTone(diag.result)}>{diag.result}</Badge>}
      />
      <DiagnosticChecksCard checks={diag.checks} />
      <div className="grid gap-6 lg:grid-cols-2">
        {diag.affectedFrontend.length > 0 && <ListCard title="Affected Frontend" items={diag.affectedFrontend} />}
        {diag.affectedBackend.length > 0 && <ListCard title="Affected Backend" items={diag.affectedBackend} />}
        {diag.affectedTables.length > 0 && <ListCard title="Affected Tables" items={diag.affectedTables} />}
        {diag.dependencies.length > 0 && <ListCard title="Dependencies" items={diag.dependencies} />}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Recommendation" value={diag.recommendation || '—'} />
          </CardContent>
        </Card>
      </div>
      {blocked && (
        <p className="mt-4 text-sm font-medium text-danger">
          A required check is FAIL — releasing this package version is blocked.
        </p>
      )}
    </>
  );
}

// --- Installations / Usage / Health / Audit ----------------------------------

const INSTALL_STATUSES: PackageInstallationStatus[] = [
  'pending',
  'installing',
  'installed',
  'failed',
  'retrying',
  'rolled_back',
];

export function InstallationsPage() {
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget('all_companies'));
  const [status, setStatus] = useState<PackageInstallationStatus | ''>('');
  const retry = useRetryInstallation();
  const rollback = useRollbackInstallation();
  const [pending, setPending] = useState<PackageInstallation | null>(null);
  // all_companies → no company filter; RLS keeps results tenant-safe regardless.
  const companyIds = target.mode === 'all_companies' ? undefined : target.companyIds;
  const query = useInstallationsMonitor({ companyIds, status: status || undefined });
  const filtered = query.data ?? [];
  const recovering = retry.isPending || rollback.isPending;
  return (
    <>
      <PageHeader
        title="Installation Monitoring"
        description="Package installations across companies"
        actions={<RefreshingIndicator show={query.isFetching && !query.isPending} />}
      />
      <TargetFilter value={target} onChange={setTarget} />
      <Card className="mb-6 max-w-xs">
        <CardContent className="pt-6">
          <Field label="Status">
            <select
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as PackageInstallationStatus | '')}
              aria-label="Installation status"
            >
              <option value="">All statuses</option>
              {INSTALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>
      <TableBoundary query={query} filtered={filtered} cols={6}>
        <DataTable>
          <THead>
            <TH>Company</TH>
            <TH>Package</TH>
            <TH>Version</TH>
            <TH>Status</TH>
            <TH>Completed</TH>
            <TH>Recovery</TH>
          </THead>
          <TBody>
            {filtered.map((i) => (
              <TR key={i.id}>
                <TD>{i.companyName}</TD>
                <TD>{i.packageCode}</TD>
                <TD>{i.version}</TD>
                <TD>
                  <Badge tone={installTone(i.status)}>{i.status.replace(/_/g, ' ')}</Badge>
                </TD>
                <TD className="text-content-variant">{i.completedAt ? formatDate(i.completedAt) : '—'}</TD>
                <TD>
                  {canRetryInstallation(i.status) ? (
                    <Button size="sm" variant="ghost" disabled={recovering} onClick={() => retry.mutate(i)}>
                      Retry
                    </Button>
                  ) : canRollbackInstallation(i.status) ? (
                    <Button size="sm" variant="ghost" disabled={recovering} onClick={() => setPending(i)}>
                      Roll back
                    </Button>
                  ) : (
                    <span className="text-sm text-content-variant">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
      <ConfirmDialog
        open={!!pending}
        title="Roll back installation?"
        description={
          pending
            ? `${pending.packageCode} will be rolled back for ${pending.companyName}, and the company will immediately lose access to it.`
            : ''
        }
        confirmLabel="Roll back"
        tone="danger"
        pending={rollback.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && rollback.mutate(pending, { onSettled: () => setPending(null) })}
      />
    </>
  );
}

export function UsagePage() {
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget('all_companies'));
  const query = useUsage(target);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Usage Analytics" description="Per-module activity across tenants" />
      <TargetFilter value={target} onChange={setTarget} />
      <TableBoundary query={query} filtered={filtered} cols={3}>
        <DataTable>
          <THead>
            <TH>Module</TH>
            <TH>Action Count</TH>
            <TH>Companies Using</TH>
          </THead>
          <TBody>
            {filtered.map((m) => (
              <TR key={m.module}>
                <TD className="capitalize">{m.module}</TD>
                <TD>{m.actionCount}</TD>
                <TD>{m.companiesUsing}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function HealthPage() {
  const query = useHealth();
  if (query.isPending) return <PageLoadingState label="Checking system health…" />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  return (
    <>
      <PageHeader title="System Health" description="API, database and uptime signals" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {query.data.map((h) => (
          <Card key={h.label} className="p-6">
            <p className="text-label-bold uppercase text-content-variant">{h.label}</p>
            <p className="mt-2 text-xl font-semibold text-content">{h.value}</p>
            <Badge tone={h.status} className="mt-2">
              {h.status}
            </Badge>
          </Card>
        ))}
      </div>
    </>
  );
}

export function AuditPage() {
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget('all_companies'));
  const query = useAudit(target);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Platform Audit Logs" description="System and admin actions" />
      <TargetFilter value={target} onChange={setTarget} />
      <TableBoundary query={query} filtered={filtered} cols={4}>
        <DataTable>
          <THead>
            <TH>Timestamp</TH>
            <TH>Actor</TH>
            <TH>Action</TH>
            <TH>Target</TH>
          </THead>
          <TBody>
            {filtered.map((a) => (
              <TR key={a.id}>
                <TD className="text-content-variant">{new Date(a.timestamp).toLocaleString()}</TD>
                <TD>{a.actor}</TD>
                <TD>{a.action}</TD>
                <TD className="text-content-variant">{a.target}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

// --- helpers ------------------------------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-40 shrink-0 text-label-bold uppercase text-content-variant">{label}</span>
      <span className="text-content">{value}</span>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm text-content-variant">
          {items.map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
