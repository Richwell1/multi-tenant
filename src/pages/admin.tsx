import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { PageLoadingState, ErrorState, EmptyState } from '@/components/states';
import { CompanyTargetSelector, CompanyTargetSummary } from '@/components/company-target';
import { formatDate } from '@/lib/utils';
import { notify } from '@/lib/notify';
import {
  useAudit,
  useChangeRequestStatus,
  useCompanies,
  useCompany,
  useCreatePackage,
  useCreateRequest,
  useDiagnostic,
  useDiagnostics,
  useHealth,
  useInstallations,
  usePackage,
  usePackages,
  useRequest,
  useRequests,
  useUsage,
} from '@/hooks/queries';
import {
  emptyCompanyTarget,
  createCompanyTargetSchema,
  toCompanyTargetPayload,
  TARGET_MODE_LABEL,
  type CompanyTargetValue,
} from '@/lib/company-target';
import { allowedTargetModesForPackageType, allowedTargetModesForExtension, type ExtensionNature } from '@/lib/package-target';
import type {
  CompanyStatus,
  DiagnosticResult,
  PackageStatus,
  PackageType,
  RequestStatus,
} from '@/data/types';

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
const pkgTone = (s: PackageStatus) =>
  s === 'installed' ? 'healthy' : s === 'released' ? 'platform' : s === 'draft' ? 'neutral' : 'degraded';
const requestTone = (s: RequestStatus) =>
  s === 'released' || s === 'installed' || s === 'closed'
    ? 'healthy'
    : s === 'rejected'
      ? 'offline'
      : 'platform';

const REQUEST_STATUSES: RequestStatus[] = [
  'received',
  'under_review',
  'approved',
  'rejected',
  'in_development',
  'testing',
  'ready_for_release',
  'released',
  'installed',
  'closed',
];

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
  const query = useCompany(companyId as string);
  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const company = query.data;
  if (!company) return <EmptyState title="Company not found" description="This company may have been removed." />;
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
          <CardTitle>Enabled Packages</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {company.packages.map((p) => (
            <Badge key={p} tone="company">
              {p}
            </Badge>
          ))}
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

const createRequestSchema = z.object({
  companyId: z.string().min(1, 'Select a company'),
  title: z.string().min(3, 'Title is required'),
  requestType: z.string().min(1, 'Type is required'),
  sourceEmailReference: z.string().min(1, 'Email reference is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high']),
});
type CreateRequestForm = z.infer<typeof createRequestSchema>;

export function CreateRequest() {
  const navigate = useNavigate();
  const companies = useCompanies();
  const mutation = useCreateRequest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
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

  const onValid = (values: CreateRequestForm) => {
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
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <SubmitButton
              pending={statusMutation.isPending}
              pendingLabel="Updating…"
              disabled={!status}
              onClick={() => status && statusMutation.mutate(status)}
              type="button"
            >
              Update Status
            </SubmitButton>
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
      <TableBoundary query={query} filtered={filtered} searchTerm={q} cols={6}>
        <DataTable>
          <THead>
            <TH>Package</TH>
            <TH>Version</TH>
            <TH>Type</TH>
            <TH>Target</TH>
            <TH>Installs</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.key}>
                <TD>
                  <Link
                    to="/admin/packages/$packageId"
                    params={{ packageId: p.key }}
                    className="font-medium text-platform hover:underline"
                  >
                    {p.name}
                  </Link>
                </TD>
                <TD>{p.version}</TD>
                <TD className="text-content-variant">{p.type.replace(/_/g, ' ')}</TD>
                <TD>{p.target === 'all_companies' ? 'All companies' : 'One company'}</TD>
                <TD>{p.installCount}</TD>
                <TD>
                  <Badge tone={pkgTone(p.status)}>{p.status}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

const createPackageSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use semver, e.g. 1.0.0'),
  type: z.enum(['standard_update', 'private_customization', 'shared_extension', 'bug_fix']),
  releaseNotes: z.string().min(1, 'Release notes are required'),
});
type CreatePackageForm = z.infer<typeof createPackageSchema>;

export function CreatePackage() {
  const navigate = useNavigate();
  const mutation = useCreatePackage();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreatePackageForm>({
    resolver: zodResolver(createPackageSchema),
    defaultValues: { type: 'standard_update' },
  });
  const type = watch('type') as PackageType;
  const allowedModes = allowedTargetModesForPackageType(type);

  // Target selection is managed with the shared system; its mode is constrained
  // by the classification and re-normalized whenever the classification changes.
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget(allowedModes[0]));
  const [targetError, setTargetError] = useState<string | undefined>();
  useEffect(() => {
    setTarget((current) =>
      allowedModes.includes(current.mode) ? current : emptyCompanyTarget(allowedModes[0]),
    );
  }, [allowedModes]);

  const diag = useDiagnostic('diag-attendance');
  const publishBlocked = diag.data?.result === 'FAIL'; // FAIL diagnostic disables publish

  const onValid = (values: CreatePackageForm) => {
    const parsed = createCompanyTargetSchema({ allowedModes }).safeParse(target);
    if (!parsed.success) {
      setTargetError(parsed.error.issues[0]?.message ?? 'Invalid company target');
      notify.validationFailure();
      return;
    }
    setTargetError(undefined);
    const payload = toCompanyTargetPayload(target);
    mutation.mutate(
      { ...values, target: payload.target, targetCompanyIds: payload.targetCompanyIds },
      { onSuccess: () => navigate({ to: '/admin/packages' }) },
    );
  };

  return (
    <>
      <PageHeader title="Create Package Release" description="Define a package and choose its target" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onValid, () => notify.validationFailure())} className="space-y-4" noValidate>
            <Field label="Package Name" htmlFor="name" error={errors.name?.message}>
              <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field label="Version" htmlFor="version" error={errors.version?.message}>
              <Input id="version" placeholder="1.0.0" aria-invalid={!!errors.version} {...register('version')} />
            </Field>
            <Field label="Classification" htmlFor="type" error={errors.type?.message}>
              <select id="type" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" {...register('type')}>
                <option value="standard_update">Standard update</option>
                <option value="private_customization">Private customization</option>
                <option value="shared_extension">Shared extension</option>
                <option value="bug_fix">Bug fix</option>
              </select>
            </Field>
            <CompanyTargetSelector
              label="Target"
              description={
                type === 'private_customization'
                  ? 'Private customizations target exactly one company.'
                  : type === 'shared_extension'
                    ? 'Shared extensions target selected companies or all companies.'
                    : 'Standard releases can target all, selected, or one company.'
              }
              value={target}
              onChange={setTarget}
              allowedModes={allowedModes}
              error={targetError}
            />
            <Field label="Release Notes" htmlFor="releaseNotes" error={errors.releaseNotes?.message}>
              <textarea
                id="releaseNotes"
                rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                {...register('releaseNotes')}
              />
            </Field>
            <SubmitButton
              pending={mutation.isPending}
              pendingLabel="Publishing…"
              disabled={publishBlocked}
              title={publishBlocked ? 'A FAIL diagnostic blocks publishing' : undefined}
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
  const query = usePackage(packageId as string);
  const companies = useCompanies();
  const diagId = query.data?.diagnosticId ?? 'diag-leave';
  const diag = useDiagnostic(diagId);

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const pkg = query.data;
  if (!pkg) return <EmptyState title="Package not found" />;
  const targetValue: CompanyTargetValue = { mode: pkg.target, companyIds: pkg.targetCompanyIds };
  const companyOptions = (companies.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title={pkg.name}
        description={`v${pkg.version} · ${pkg.type.replace(/_/g, ' ')}`}
        actions={<Badge tone={pkgTone(pkg.status)}>{pkg.status}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Version" value={pkg.version} />
        <StatCard label="Installs" value={pkg.installCount} />
        <StatCard label="Target" value={TARGET_MODE_LABEL[pkg.target]} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Release Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-content-variant">{pkg.releaseNotes}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Result</CardTitle>
            {diag.data && <Badge tone={diagTone(diag.data.result)}>{diag.data.result}</Badge>}
          </CardHeader>
          <CardContent className="text-sm text-content-variant">
            {diag.data ? (
              <Link
                to="/admin/diagnostics/$diagnosticId"
                params={{ diagnosticId: diag.data.id }}
                className="text-platform hover:underline"
              >
                {diag.data.recommendation}
              </Link>
            ) : (
              'No diagnostic linked.'
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Target Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyTargetSummary value={targetValue} companies={companyOptions} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable>
            <THead>
              <TH>Version</TH>
              <TH>Released</TH>
              <TH>Notes</TH>
            </THead>
            <TBody>
              {pkg.history.map((h) => (
                <TR key={h.version}>
                  <TD>{h.version}</TD>
                  <TD className="text-content-variant">{h.releasedAt || '—'}</TD>
                  <TD className="text-content-variant">{h.notes}</TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        </CardContent>
      </Card>
    </>
  );
}

export function DiagnosticReportPage() {
  const { diagnosticId } = useParams({ strict: false });
  const [scope, setScope] = useState<CompanyTargetValue>(emptyCompanyTarget('all_companies'));
  const query = useDiagnostic(diagnosticId as string);
  const scoped = useDiagnostics(scope); // selection participates in the query key
  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const diag = query.data;
  if (!diag) return <EmptyState title="Diagnostic not found" />;
  return (
    <>
      <PageHeader
        title="Diagnostic Report"
        description={diag.packageKey}
        actions={<Badge tone={diagTone(diag.result)}>{diag.result}</Badge>}
      />
      <Card className="mb-6">
        <CardContent className="pt-6">
          <CompanyTargetSelector
            label="Compatibility scope"
            description="Run diagnostics against all, selected, or one company."
            value={scope}
            onChange={setScope}
          />
          <p className="mt-3 text-sm text-content-variant">
            {scoped.isPending ? 'Loading…' : `${scoped.data?.length ?? 0} diagnostic report(s) in scope.`}
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Affected Frontend" items={diag.affectedFrontend} />
        <ListCard title="Affected Backend" items={diag.affectedBackend} />
        <ListCard title="Affected Tables" items={diag.affectedTables} />
        <ListCard title="Required Permissions" items={diag.requiredPermissions} />
        <ListCard title="Dependencies" items={diag.dependencies} />
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Data Impact" value={diag.estimatedDataImpact} />
            <Row label="Compatibility" value={diag.compatibility} />
            <Row label="Recommendation" value={diag.recommendation} />
          </CardContent>
        </Card>
      </div>
      {diag.result === 'FAIL' && (
        <p className="mt-4 text-sm font-medium text-danger">
          A FAIL result disables the Publish action for this package.
        </p>
      )}
    </>
  );
}

// --- Installations / Usage / Health / Audit ----------------------------------

export function InstallationsPage() {
  const [target, setTarget] = useState<CompanyTargetValue>(emptyCompanyTarget('all_companies'));
  const query = useInstallations(target);
  const companies = useCompanies();
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader
        title="Installation Monitoring"
        description="Package assignments across companies"
        actions={<RefreshingIndicator show={query.isFetching && !query.isPending} />}
      />
      <TargetFilter value={target} onChange={setTarget} />
      <TableBoundary query={query} filtered={filtered} cols={5}>
        <DataTable>
          <THead>
            <TH>Company</TH>
            <TH>Package</TH>
            <TH>Version</TH>
            <TH>State</TH>
            <TH>Activated</TH>
          </THead>
          <TBody>
            {filtered.map((i) => (
              <TR key={i.id}>
                <TD>{companies.data?.find((c) => c.id === i.companyId)?.name ?? i.companyId}</TD>
                <TD>{i.packageKey}</TD>
                <TD>{i.packageVersion}</TD>
                <TD>
                  <Badge tone={i.state === 'installed' ? 'healthy' : i.state === 'failed' ? 'offline' : 'degraded'}>
                    {i.state}
                  </Badge>
                </TD>
                <TD className="text-content-variant">{i.activatedAt ? formatDate(i.activatedAt) : '—'}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
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
