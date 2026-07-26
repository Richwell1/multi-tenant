import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Search,
  LayoutDashboard,
  Building2,
  Inbox,
  Package,
  DownloadCloud,
  TrendingUp,
  BarChart3,
  Activity,
  ScrollText,
  Stethoscope,
  CheckCircle2,
} from 'lucide-react';
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
import { actionLabel } from '@/lib/audit-labels';
import { notify } from '@/lib/notify';
import { useCompanies, useCompany } from '@/hooks/queries';
import { useUsage } from '@/hooks/usage';
import { useAudit } from '@/hooks/audit';
import { useHealth } from '@/hooks/health';
import { resolveOptionalWidget } from '@/lib/admin-dashboard';
import { useDiagnostic, useDiagnostics } from '@/hooks/diagnostics';
import { DIAGNOSTIC_DIMENSIONS, type DiagnosticCheck } from '@/data/diagnostics';
import {
  useCompanyAssignments,
  useInstallationsMonitor,
  usePackage,
  usePackages,
  usePackageVersions,
  useReleaseDetails,
  useCreatePackage,
  useCreatePackageVersion,
  usePublishRelease,
  useRetryInstallation,
  useRollbackInstallation,
} from '@/hooks/packages';
import { useMarketplaceAdoption } from '@/hooks/marketplace';
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
import type { CreatePackageInput } from '@/data/packages';
import {
  emptyCompanyTarget,
  createCompanyTargetSchema,
  type CompanyTargetValue,
} from '@/lib/company-target';
import { allowedTargetModesForPackageType, allowedTargetModesForExtension, type ExtensionNature } from '@/lib/package-target';
import {
  packageCategoryLabel,
  packageVisibilityLabel,
  packageInstallerLabel,
  PACKAGE_CATEGORIES,
  type PackageCategory,
} from '@/lib/packages/category';
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
  const healthWidget = resolveOptionalWidget(health);
  const auditWidget = resolveOptionalWidget(audit);

  if (companies.isPending) return <PageLoadingState label="Loading platform overview…" />;
  if (companies.isError)
    return <ErrorState onRetry={() => companies.refetch()} retrying={companies.isFetching} />;

  if (companies.data.length === 0) {
    return (
      <>
        <PageHeader
          title="Platform Dashboard"
        icon={<LayoutDashboard className="size-5" />}
          description="Multi-Tenants HR — system overview"
          actions={<RefreshingIndicator show={companies.isFetching} />}
        />
        <EmptyState
          title="No companies yet"
          description="Registered tenant companies will appear here after the first company completes registration."
        />
      </>
    );
  }

  const active = companies.data.filter((c) => c.status === 'active').length;
  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        icon={<LayoutDashboard className="size-5" />}
        description="Multi-Tenants HR — system overview"
        actions={<RefreshingIndicator show={companies.isFetching} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Companies" value={companies.data.length} icon={<Building2 className="size-5" />} />
        <StatCard label="Active Companies" value={active} icon={<CheckCircle2 className="size-5" />} />
        <StatCard label="Using HR Core" value={companies.data.length} hint="Auto-assigned" icon={<Package className="size-5" />} />
        <StatCard label="Most-used Module" value="Employees" icon={<BarChart3 className="size-5" />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {auditWidget.state === 'loading' && <p className="text-content-variant">Loading activity…</p>}
            {auditWidget.state === 'unavailable' && (
              <p className="text-content-variant">Activity is temporarily unavailable.</p>
            )}
            {auditWidget.state === 'empty' && <p className="text-content-variant">No activity yet.</p>}
            {auditWidget.rows.slice(0, 3).map((a) => (
              <div key={a.id} className="flex justify-between">
                <span className="text-content">{actionLabel(a.action)}</span>
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
            {healthWidget.state === 'loading' && <p className="text-content-variant">Checking health…</p>}
            {healthWidget.state === 'unavailable' && (
              <p className="text-content-variant">Health signals are temporarily unavailable.</p>
            )}
            {healthWidget.state === 'empty' && <p className="text-content-variant">No health signals yet.</p>}
            {healthWidget.rows.map((h) => (
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

const COMPANY_STATUS_FILTERS: Array<{ value: 'all' | CompanyStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export function CompaniesList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | CompanyStatus>('all');
  const query = useCompanies();
  const all = query.data ?? [];
  const activeCount = all.filter((c) => c.status === 'active').length;
  const filtered = all.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    const haystack = `${c.name} ${c.subdomain}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  });
  return (
    <>
      <PageHeader
        title="Companies"
        icon={<Building2 className="size-5" />}
        description="All registered tenant companies"
        actions={
          <>
            <RefreshingIndicator show={query.isFetching && !query.isPending} />
            <SearchBar value={q} onChange={setQ} />
          </>
        }
      />
      {all.length > 0 && (
        <p className="mb-4 text-sm text-content-variant">
          <span className="font-medium tabular-nums text-content">{all.length}</span> companies ·{' '}
          <span className="font-medium tabular-nums text-content">{activeCount}</span> active
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {COMPANY_STATUS_FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={status === f.value ? undefined : 'outline'} onClick={() => setStatus(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>
      <TableBoundary
        query={query}
        filtered={filtered}
        searchTerm={q}
        cols={6}
        emptyTitle="No companies registered"
        emptyDescription="New companies will appear here after registration."
      >
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
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-platform/10 text-xs font-semibold uppercase text-platform" aria-hidden>
                      {c.name.trim().charAt(0) || '?'}
                    </span>
                    <Link
                      to="/admin/companies/$companyId"
                      params={{ companyId: c.id }}
                      className="font-medium text-platform hover:underline"
                    >
                      {c.name}
                    </Link>
                  </div>
                </TD>
                <TD className="text-content-variant">{c.subdomain}</TD>
                <TD className="tabular-nums">{c.employeeCount}</TD>
                <TD>
                  <Badge tone="neutral">{c.packages.length}</Badge>
                </TD>
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
        icon={<Inbox className="size-5" />}
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
      <TableBoundary
        query={query}
        filtered={filtered}
        searchTerm={q}
        cols={5}
        emptyTitle="No request records yet"
        emptyDescription="Log a request to begin tracking feature demand."
      >
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

export function DiagnosticsList() {
  const query = useDiagnostics();
  const rows = query.data ?? [];
  return (
    <>
      <PageHeader icon={<Stethoscope className="size-5" />} title="Diagnostics" description="Package compatibility and release-readiness checks" />
      <TableBoundary
        query={query}
        filtered={rows}
        cols={4}
        emptyTitle="No diagnostics available"
        emptyDescription="Run package diagnostics before publishing a release."
      >
        <DataTable>
          <THead>
            <TH>Package</TH>
            <TH>Result</TH>
            <TH>Checks</TH>
            <TH>Recommendation</TH>
          </THead>
          <TBody>
            {rows.map((report) => (
              <TR key={report.id}>
                <TD>
                  <Link
                    to="/admin/diagnostics/$diagnosticId"
                    params={{ diagnosticId: report.id }}
                    className="font-medium text-platform hover:underline"
                  >
                    {report.packageKey}
                  </Link>
                </TD>
                <TD><Badge tone={diagTone(report.result)}>{report.result}</Badge></TD>
                <TD>{report.checks.length} / {DIAGNOSTIC_DIMENSIONS.length}</TD>
                <TD className="text-content-variant">{report.recommendation || '—'}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

/** Distinct badge tones per category (text label still carries the meaning). */
const CATEGORY_TONE: Record<PackageCategory, 'platform' | 'company' | 'warning' | 'role'> = {
  standard_package: 'platform',
  marketplace_extension: 'company',
  private_extension: 'warning',
  private_standalone: 'role',
};

export function PackagesList() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'all' | PackageCategory>('all');
  const query = usePackages();
  const all = query.data ?? [];
  const nameByCode = new Map(all.map((p) => [p.code, p.name]));
  const baseName = (code: string | null) => (code ? nameByCode.get(code) ?? code : '');
  const filtered = all.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    const haystack = `${p.name} ${p.code} ${packageCategoryLabel(p.category)} ${baseName(p.basePackageKey)}`.toLowerCase();
    return haystack.includes(q.toLowerCase());
  });
  return (
    <>
      <PageHeader
        title="Packages"
        icon={<Package className="size-5" />}
        description="System packages, marketplace extensions, and private packages"
        actions={
          <>
            <SearchBar value={q} onChange={setQ} />
            <Link to="/admin/packages/new">
              <Button variant="outline">Create Package</Button>
            </Link>
            <Link to="/admin/packages/releases/new">
              <Button>Create Package Release</Button>
            </Link>
          </>
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-content-variant">
        System packages are managed by the platform. Marketplace extensions are installed by companies.
        Private packages are assigned by Platform Admin to one company.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...PACKAGE_CATEGORIES] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? undefined : 'outline'}
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? 'All' : packageCategoryLabel(c)}
          </Button>
        ))}
      </div>
      <TableBoundary
        query={query}
        filtered={filtered}
        searchTerm={q}
        cols={5}
        emptyTitle="No packages yet"
        emptyDescription="Package catalog entries will appear here when they are added."
      >
        <DataTable>
          <THead>
            <TH>Package</TH>
            <TH>Category</TH>
            <TH>Visibility</TH>
            <TH>Base Package</TH>
            <TH>Status</TH>
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
                <TD>
                  <Badge tone={CATEGORY_TONE[p.category]}>{packageCategoryLabel(p.category)}</Badge>
                </TD>
                <TD className="text-content-variant">{packageVisibilityLabel(p.category)}</TD>
                <TD className="text-content-variant">{p.basePackageKey ? baseName(p.basePackageKey) : '—'}</TD>
                <TD>
                  <Badge tone={p.isActive ? 'healthy' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

// The three demo package types. "Standalone private package" maps to the
// existing `private_customization` enum value (one company, no base package);
// `private_extension` is the new one-company type that requires a base package.
const PACKAGE_CREATION_TYPES: Array<{ value: Extract<PackageType, 'standard_update' | 'private_extension' | 'private_customization'>; label: string }> = [
  { value: 'standard_update', label: 'Standard update' },
  { value: 'private_extension', label: 'Private extension' },
  { value: 'private_customization', label: 'Standalone private package' },
];

export function CreatePackage() {
  const navigate = useNavigate();
  const create = useCreatePackage();
  const packagesQuery = usePackages();
  const [form, setForm] = useState<CreatePackageInput>({
    code: '', name: '', classification: 'standard_update', description: '', version: '1.0.0', releaseNotes: '', baseCode: '',
  });
  const [error, setError] = useState<string>();

  const isExtension = form.classification === 'private_extension';
  // Base-package options: any existing active package other than the one being created.
  const baseOptions = (packagesQuery.data ?? []).filter((p) => p.isActive && p.code !== form.code);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(form, {
      onSuccess: (result) => navigate({ to: '/admin/packages/$packageId', params: { packageId: result.package.code } }),
      onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Package creation failed. Please try again.'),
    });
  };

  return (
    <>
      <PageHeader title="New Package" description="Create package metadata and its first version" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Package name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Package key" hint="Lowercase kebab-case, for example attendance-management.">
              <Input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Package type">
              <select
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={form.classification}
                onChange={(e) => {
                  const classification = e.target.value as CreatePackageInput['classification'];
                  // Only a private extension keeps a base package.
                  setForm({ ...form, classification, baseCode: classification === 'private_extension' ? form.baseCode : '' });
                }}
              >
                {PACKAGE_CREATION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </Field>
            {isExtension && (
              <Field label="Base package" hint="The private extension is only installable where this base package is already enabled.">
                <select
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  value={form.baseCode ?? ''}
                  onChange={(e) => setForm({ ...form, baseCode: e.target.value })}
                >
                  <option value="">Select a base package…</option>
                  {baseOptions.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
                </select>
              </Field>
            )}
            <Field label="Description">
              <textarea className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Initial version" hint="Use semantic versioning, for example 1.0.0.">
              <Input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </Field>
            <Field label="Release notes">
              <textarea required className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={form.releaseNotes} onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })} />
            </Field>
            {(form.classification === 'private_customization' || isExtension) && <p className="text-sm text-content-variant">Private packages are not assigned during creation. Publish a release separately and target one company.{isExtension && ' The target company must already have the base package enabled.'}</p>}
            <SubmitButton pending={create.isPending} pendingLabel="Creating…">Create Package</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

export function CreatePackageVersion() {
  const navigate = useNavigate();
  const { packageKey } = useParams({ strict: false });
  const code = packageKey as string;
  const pkg = usePackage(code);
  const create = useCreatePackageVersion();
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [compatibilityNotes, setCompatibilityNotes] = useState('');
  const [error, setError] = useState<string>();

  if (pkg.isPending) return <PageLoadingState />;
  if (pkg.isError) return <ErrorState onRetry={() => pkg.refetch()} retrying={pkg.isFetching} />;
  if (!pkg.data) return <EmptyState title="Package not found" />;
  if (!pkg.data.isActive) return <EmptyState title="Package is inactive" description="Reactivate the package before creating another version." />;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate({ packageCode: code, version, releaseNotes, compatibilityNotes }, {
      onSuccess: () => navigate({ to: '/admin/packages/$packageId', params: { packageId: code } }),
      onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Version creation failed. Please try again.'),
    });
  };

  return (
    <>
      <PageHeader title={`New ${pkg.data.name} version`} description="Create a version without publishing or assigning it" />
      <Card className="max-w-2xl"><CardContent className="pt-6">
        {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Version"><Input required value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
          <Field label="Release notes"><textarea required className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} /></Field>
          <Field label="Compatibility notes"><textarea className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={compatibilityNotes} onChange={(e) => setCompatibilityNotes(e.target.value)} /></Field>
          <SubmitButton pending={create.isPending} pendingLabel="Creating…">Create Version</SubmitButton>
        </form>
      </CardContent></Card>
    </>
  );
}

export function CreatePackageRelease() {
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
        onSuccess: (result) => navigate({ to: '/admin/releases/$releaseId', params: { releaseId: result.releaseId } }),
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
                classification === 'private_extension'
                  ? 'Private extensions target exactly one company, which must already have the base package enabled.'
                  : classification === 'private_customization'
                    ? 'Standalone private packages target exactly one company.'
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
  const catalog = usePackages();
  const versions = usePackageVersions(code);
  const installs = useInstallationsMonitor({ packageCode: code });

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const pkg = query.data;
  if (!pkg) return <EmptyState title="Package not found" />;

  // Resolve the base package's display name (falls back to its key).
  const nameByCode = new Map((catalog.data ?? []).map((p) => [p.code, p.name]));
  const baseName = (c: string) => nameByCode.get(c) ?? c;

  const rows = installs.data ?? [];
  const installed = rows.filter((r) => r.status === 'installed').length;
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'installing').length;
  const failed = rows.filter((r) => r.status === 'failed').length;

  const baseLabel = pkg.basePackageKey ? baseName(pkg.basePackageKey) : '—';

  return (
    <>
      <PageHeader
        title={pkg.name}
        description={`${pkg.code} · ${packageCategoryLabel(pkg.category)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pkg.isActive && <Link to="/admin/packages/$packageKey/versions/new" params={{ packageKey: pkg.code }}><Button size="sm" variant="outline">New Version</Button></Link>}
            <Badge tone={pkg.isActive ? 'healthy' : 'neutral'}>{pkg.isActive ? 'Active' : 'Inactive'}</Badge>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Installed" value={installed} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Failed" value={failed} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-content-variant">Category</p>
            <Badge tone={CATEGORY_TONE[pkg.category]}>{packageCategoryLabel(pkg.category)}</Badge>
          </div>
          <div>
            <p className="text-content-variant">Visibility</p>
            <p className="font-medium">{packageVisibilityLabel(pkg.category)}</p>
          </div>
          <div>
            <p className="text-content-variant">Base package</p>
            <p className="font-medium">{baseLabel}</p>
          </div>
          <div>
            <p className="text-content-variant">Installed by</p>
            <p className="font-medium">{packageInstallerLabel(pkg.category)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-content-variant">Description</p>
            <p>{pkg.description || '—'}</p>
          </div>
        </CardContent>
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

export function ReleaseDetails() {
  const { releaseId } = useParams({ strict: false });
  const query = useReleaseDetails(releaseId as string);
  const retry = useRetryInstallation();
  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  if (!query.data) return <EmptyState title="Release not found" />;

  const release = query.data;
  const installed = release.installations.filter((i) => i.status === 'installed').length;
  const failed = release.installations.filter((i) => i.status === 'failed').length;
  const pending = release.installations.filter((i) => ['pending', 'installing', 'retrying'].includes(i.status)).length;

  return (
    <>
      <PageHeader
        title={`${release.packageName} ${release.version}`}
        description={`${release.packageCode} · ${release.classification.replace(/_/g, ' ')}`}
        actions={<Badge tone={failed ? 'degraded' : pending ? 'platform' : 'healthy'}>{failed ? 'attention required' : pending ? 'in progress' : 'complete'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total targets" value={release.installations.length} />
        <StatCard label="Installed" value={installed} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="Pending" value={pending} />
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Release plan</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
          <Row label="Target type" value={release.mode.replace(/_/g, ' ')} />
          <Row label="Released" value={formatDate(release.releasedAt)} />
          <Row label="Automatic installation" value={release.automaticInstall ? 'Enabled' : 'Disabled'} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader><CardTitle>Per-company installations</CardTitle></CardHeader>
        <CardContent>
          {release.installations.length === 0 ? <EmptyState title="No target installations" /> : (
            <DataTable>
              <THead><TH>Company</TH><TH>Status</TH><TH>Attempts</TH><TH>Failure</TH><TH>Action</TH></THead>
              <TBody>
                {release.installations.map((installation) => (
                  <TR key={installation.id}>
                    <TD>{installation.companyName}</TD>
                    <TD><Badge tone={installTone(installation.status)}>{installation.status.replace(/_/g, ' ')}</Badge></TD>
                    <TD>{installation.attemptCount}</TD>
                    <TD className="text-content-variant">{installation.lastErrorMessage ?? installation.error ?? '—'}</TD>
                    <TD>{canRetryInstallation(installation.status) ? <Button size="sm" variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(installation)}>Retry</Button> : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </>
  );
}

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
        icon={<DownloadCloud className="size-5" />}
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
      <TableBoundary
        query={query}
        filtered={filtered}
        cols={6}
        emptyTitle="No installations yet"
        emptyDescription="Package installation activity will appear here after a release is targeted to a company."
      >
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
      <PageHeader icon={<BarChart3 className="size-5" />} title="Usage Analytics" description="Per-module activity across tenants" />
      <TargetFilter value={target} onChange={setTarget} />
      <TableBoundary
        query={query}
        filtered={filtered}
        cols={3}
        emptyTitle="No usage data yet"
        emptyDescription="Module activity will appear here as companies use the platform."
      >
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
  if (query.data.length === 0) {
    return (
      <>
        <PageHeader icon={<Activity className="size-5" />} title="System Health" description="API, database and uptime signals" />
        <EmptyState
          title="No health signals yet"
          description="System health checks will appear here once the platform records its first signal."
        />
      </>
    );
  }
  return (
    <>
      <PageHeader icon={<Activity className="size-5" />} title="System Health" description="API, database and uptime signals" />
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
      <PageHeader icon={<ScrollText className="size-5" />} title="Platform Audit Logs" description="System and admin actions" />
      <TargetFilter value={target} onChange={setTarget} />
      <TableBoundary
        query={query}
        filtered={filtered}
        cols={4}
        emptyTitle="No audit activity yet"
        emptyDescription="Platform and administrator actions will appear here as they occur."
      >
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
                <TD>{actionLabel(a.action)}</TD>
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

export function AdoptionPage() {
  const query = useMarketplaceAdoption();
  const rows = query.data ?? [];
  return (
    <>
      <PageHeader icon={<TrendingUp className="size-5" />} title="Marketplace Adoption" description="How many companies installed each marketplace extension" />
      <TableBoundary query={query} filtered={rows} cols={3} emptyTitle="No marketplace extensions" emptyDescription="Adoption appears once marketplace extensions are published.">
        <DataTable>
          <THead>
            <TH>Extension</TH>
            <TH>Installs</TH>
            <TH>Companies</TH>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.packageKey}>
                <TD className="font-medium">{r.packageName}<span className="ml-2 text-content-variant">{r.packageKey}</span></TD>
                <TD>{r.installCount}</TD>
                <TD>{r.distinctCompanies}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}
