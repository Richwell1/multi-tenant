import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, LayoutDashboard, Users, Building, Briefcase, Package, RefreshCw, Store, Settings as SettingsIcon, Megaphone, Boxes, Gauge, Network } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { APP_VERSION } from '@/lib/app-version';
import {
  PACKAGE_MANIFEST,
  hasFeature,
  installedVersion,
  marketplaceCategory,
  packageFeatureLabels,
  MARKETPLACE_CATEGORIES,
  type MarketplaceCategory,
} from '@/lib/packages/manifest';
import type { PackageKey } from '@/data/types';
import { useMarketplacePackages, useInstallMarketplaceExtension } from '@/hooks/marketplace';
import { useDocumentNotes, useCreateDocumentNote } from '@/hooks/document-notes';
import { useAnnouncements, useCreateAnnouncement } from '@/hooks/announcements';
import { useAssets, useCreateAsset } from '@/hooks/assets';
import { usePulseSurveys, useCreatePulseSurvey } from '@/hooks/pulse-surveys';
import { useExpenseRequests, useCreateExpenseRequest } from '@/hooks/expense-requests';
import { useVisitorEntries, useCreateVisitor } from '@/hooks/visitor-register';
import { useAvailableUpdates, useInstallCompanyUpdate, useAvailableUpdateCount } from '@/hooks/company-updates';
import { packageCategoryLabel, type PackageCategory } from '@/lib/packages/category';
import { formatDate } from '@/lib/utils';
import { RepositoryError } from '@/data/errors';
import { StatCard } from '@/components/stat-card';
import { InstalledPackagesPanel } from '@/components/installed-packages-panel';
import { PackageReviewDialog } from '@/components/package-review-dialog';
import { latestImpactManifest, type PackageImpactManifest } from '@/lib/packages/impact';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { DataTable, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { TableBoundary, RefreshingIndicator } from '@/components/table-boundary';
import {
  PageLoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
} from '@/components/states';
import { useSession } from '@/lib/session';
import { useCompanyId } from '@/hooks/use-company-id';
import { useCompanySlug } from '@/hooks/use-company-slug';
import { useCompanyContext } from '@/hooks/context';
import { PackageGuard } from '@/components/guards';
import { usePackageEntitlements } from '@/hooks/entitlements';
import { PACKAGE_CODES } from '@/lib/entitlements';
import { notify } from '@/lib/notify';
import {
  useCompanyUsers,
  useSaveSettings,
} from '@/hooks/queries';
import { useDepartments, useCreateDepartment, useDisableDepartment } from '@/hooks/departments';
import { usePositions, useCreatePosition, useDisablePosition } from '@/hooks/positions';
import { useEmployees, useEmployee, useCreateEmployee, useTerminateEmployee } from '@/hooks/employees';
import { useLeaveRequests, useCreateLeaveRequest, useDecideLeaveRequest } from '@/hooks/leave';
import type { LeaveRequest } from '@/data/leave';
import { useAttendanceRecords, useCreateAttendance, useCheckOutAttendance } from '@/hooks/attendance';
import { canCheckOut, type AttendanceRecord } from '@/data/attendance';
import { positionFormSchema, type PositionFormValues } from '@/services/position-service';
import { employeeFormSchema, type EmployeeFormValues } from '@/services/employee-service';
import { leaveRequestFormSchema, type LeaveRequestFormValues } from '@/services/leave-service';
import { attendanceFormSchema, type AttendanceFormValues } from '@/services/attendance-service';

function useTenantId() {
  // Mock mode uses the route slug; Supabase mode uses the real company UUID
  // resolved from the signed-in membership context.
  return useCompanyId();
}

// --- Dashboard ----------------------------------------------------------------

export function WorkspaceDashboard() {
  const { company } = useSession();
  const companyContext = useCompanyContext();
  const companyName = company?.name ?? companyContext.data?.companyName ?? 'Company';
  const { packages } = usePackageEntitlements();
  const updateCount = useAvailableUpdateCount();
  const employees = useEmployees();
  const departments = useDepartments();
  const positions = usePositions();

  if (employees.isPending) return <PageLoadingState label={`Loading ${companyName}…`} />;
  if (employees.isError)
    return <ErrorState onRetry={() => employees.refetch()} retrying={employees.isFetching} />;

  const hrCoreVersion = installedVersion(packages, PACKAGE_CODES.hrCore);
  const installedCount = packages.length;

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title={companyName}
        description="Manage your people, packages, and company activity."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hrCoreVersion && <Badge tone="company">HR Core {hrCoreVersion}</Badge>}
            <Badge tone="neutral">Platform {APP_VERSION}</Badge>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={employees.data.length} icon={<Users className="size-5" />} />
        <StatCard label="Departments" value={departments.data?.length ?? '—'} icon={<Building className="size-5" />} />
        <StatCard label="Positions" value={positions.data?.length ?? '—'} icon={<Briefcase className="size-5" />} />
        <StatCard label="Installed Packages" value={installedCount} icon={<Package className="size-5" />} />
        <StatCard label="Available Updates" value={updateCount} hint={updateCount > 0 ? 'Review in Available Updates' : 'Up to date'} icon={<RefreshCw className="size-5" />} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Installed packages</CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-sm text-content-variant">No packages installed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {packages.map((p) => {
                const entry = PACKAGE_MANIFEST[p.code as PackageKey];
                return (
                  <li key={p.code} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium text-content">{entry?.name ?? p.code}</span>
                    <span className="text-content-variant">Version {p.version ?? '—'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// --- Employees ----------------------------------------------------------------

export function EmployeesList() {
  // Employees is an HR Core 1.1.0 feature — gate the route on the installed version.
  return (
    <PackageGuard packageCode={PACKAGE_CODES.hrCore} minVersion="1.1.0" packageName="HR Core">
      <EmployeesListContent />
    </PackageGuard>
  );
}

function EmployeesListContent() {
  const [q, setQ] = useState('');
  const companySlug = useCompanySlug();
  const query = useEmployees();
  const { packages } = usePackageEntitlements();
  // Private extension: only the assigned company (with HR Core >= 1.1.0) sees this card.
  const hasApproval = hasFeature(packages, PACKAGE_CODES.employeeApproval, '1.0.0');
  const filtered = (query.data ?? []).filter((e) =>
    `${e.fullName} ${e.employeeNumber} ${e.department}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Employees"
        actions={
          <>
            <RefreshingIndicator show={query.isFetching && !query.isPending} />
            <Input className="w-full sm:w-56" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
            <Link to="/$companySlug/employees/new" params={{ companySlug }}>
              <Button>Add Employee</Button>
            </Link>
          </>
        }
      />
      {hasApproval && (
        <Card className="mb-6 max-w-md">
          <CardHeader>
            <CardTitle>Employee Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge tone="healthy">Enabled</Badge>
          </CardContent>
        </Card>
      )}
      <TableBoundary
        query={query}
        filtered={filtered}
        searchTerm={q}
        cols={6}
        emptyTitle="No employees yet"
        emptyDescription="Add your first employee to get started."
      >
        <DataTable>
          <THead>
            <TH>Number</TH>
            <TH>Name</TH>
            <TH>Department</TH>
            <TH>Position</TH>
            <TH>Type</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((e) => (
              <TR key={e.id}>
                <TD className="text-content-variant">{e.employeeNumber}</TD>
                <TD>
                  <Link to="/$companySlug/employees/$employeeId" params={{ companySlug, employeeId: e.id }} className="font-medium text-company hover:underline">
                    {e.fullName}
                  </Link>
                </TD>
                <TD>{e.department}</TD>
                <TD>{e.position}</TD>
                <TD className="capitalize">{e.employmentType.replace(/_/g, ' ')}</TD>
                <TD>
                  <Badge tone={e.status === 'active' ? 'healthy' : e.status === 'on_leave' ? 'degraded' : 'offline'}>
                    {e.status.replace(/_/g, ' ')}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function AddEmployee() {
  const navigate = useNavigate();
  const companySlug = useCompanySlug();
  const mutation = useCreateEmployee();
  const departmentsQuery = useDepartments();
  const positionsQuery = usePositions();
  const departmentOptions = (departmentsQuery.data ?? []).filter((d) => d.status === 'active');
  const positionOptions = (positionsQuery.data ?? []).filter((p) => p.status === 'active');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { employmentType: 'full_time' },
  });

  const onValid = (values: EmployeeFormValues) =>
    mutation.mutate(values, { onSuccess: () => navigate({ to: '/$companySlug/employees', params: { companySlug } }) });

  return (
    <>
      <PageHeader title="Add Employee" description="Create a new employee record" />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onValid, () => notify.validationFailure())} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Employee Number" htmlFor="employeeNumber" error={errors.employeeNumber?.message}>
              <Input id="employeeNumber" aria-invalid={!!errors.employeeNumber} {...register('employeeNumber')} />
            </Field>
            <Field label="Full Name" htmlFor="fullName" error={errors.fullName?.message}>
              <Input id="fullName" aria-invalid={!!errors.fullName} {...register('fullName')} />
            </Field>
            <Field label="Work Email" htmlFor="workEmail" error={errors.workEmail?.message}>
              <Input id="workEmail" type="email" aria-invalid={!!errors.workEmail} {...register('workEmail')} />
            </Field>
            <Field label="Department" htmlFor="department" error={errors.departmentId?.message}>
              <select id="department" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" {...register('departmentId')}>
                <option value="">Unassigned</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Position" htmlFor="position" error={errors.positionId?.message}>
              <select id="position" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" {...register('positionId')}>
                <option value="">Unassigned</option>
                {positionOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employment Type" htmlFor="employmentType" error={errors.employmentType?.message}>
              <select id="employmentType" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" {...register('employmentType')}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
              </select>
            </Field>
            <div className="col-span-full flex gap-2">
              <SubmitButton pending={mutation.isPending} pendingLabel="Saving…">
                Save Employee
              </SubmitButton>
              <Link to="/$companySlug/employees" params={{ companySlug }}>
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

export function EmployeeProfile() {
  const { employeeId } = useParams({ strict: false });
  const query = useEmployee(employeeId as string);
  const terminateMutation = useTerminateEmployee(employeeId as string);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const employee = query.data;
  if (!employee) return <EmptyState title="Employee not found" />;
  const isTerminated = employee.status === 'terminated';

  return (
    <>
      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeNumber} · ${employee.workEmail}`}
        actions={
          <Badge tone={isTerminated ? 'offline' : 'healthy'}>{employee.status.replace(/_/g, ' ')}</Badge>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Department" value={employee.department} />
        <StatCard label="Position" value={employee.position} />
        <StatCard label="Type" value={employee.employmentType.replace(/_/g, ' ')} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          {isTerminated ? (
            <p className="text-sm text-danger">This employee has been terminated.</p>
          ) : (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Terminate Employee
            </Button>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        title="Terminate employee?"
        description={`This will set ${employee.fullName} to terminated.`}
        confirmLabel="Terminate"
        tone="danger"
        pending={terminateMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          terminateMutation.mutate(
            {},
            { onSuccess: () => setConfirmOpen(false), onError: () => setConfirmOpen(false) },
          )
        }
      />
    </>
  );
}

// --- Departments / Positions --------------------------------------------------

// Code is an optional field provided by the Custom Department Code Field
// extension; baseline HR Core departments do not require it.
const departmentSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().trim().max(40).optional(),
  head: z.string().optional(),
});
type DepartmentForm = z.infer<typeof departmentSchema>;

export function DepartmentsPage() {
  // Departments is the HR Core 1.0.0 baseline feature — gate on the entitlement.
  return (
    <PackageGuard packageCode={PACKAGE_CODES.hrCore} packageName="HR Core">
      <DepartmentsContent />
    </PackageGuard>
  );
}

function DepartmentsContent() {
  const query = useDepartments();
  const createMutation = useCreateDepartment();
  const disableMutation = useDisableDepartment();
  const { packages } = usePackageEntitlements();
  // Private extension: only the assigned company surfaces the Department Code field.
  const hasDeptCode = hasFeature(packages, PACKAGE_CODES.departmentCode, '1.0.0');
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const filtered = query.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentForm>({ resolver: zodResolver(departmentSchema) });

  const onCreate = (values: DepartmentForm) =>
    createMutation.mutate(values, {
      onSuccess: () => {
        reset();
        setShowAdd(false);
      },
    });

  return (
    <>
      <PageHeader
        title="Departments"
        description="Organizational units in this workspace"
        icon={<Building className="size-5" />}
        actions={<Button onClick={() => setShowAdd((s) => !s)}>Add Department</Button>}
      />
      {showAdd && (
        <Card className="mb-6 max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onCreate, () => notify.validationFailure())} className="grid gap-4 sm:grid-cols-3" noValidate>
              <Field label="Name" htmlFor="dept-name" error={errors.name?.message}>
                <Input id="dept-name" aria-invalid={!!errors.name} {...register('name')} />
              </Field>
              {hasDeptCode && (
                <Field label="Code" htmlFor="dept-code" error={errors.code?.message}>
                  <Input id="dept-code" aria-invalid={!!errors.code} {...register('code')} />
                </Field>
              )}
              <Field label="Head" htmlFor="dept-head">
                <Input id="dept-head" {...register('head')} />
              </Field>
              <div className="col-span-full flex gap-2">
                <SubmitButton pending={createMutation.isPending} pendingLabel="Saving…">
                  Save Department
                </SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    reset();
                    setShowAdd(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <TableBoundary
        query={query}
        filtered={filtered}
        cols={hasDeptCode ? 4 : 3}
        emptyTitle="No departments yet"
        emptyDescription="Create your first department to start organizing this workspace."
        emptyAction={<Button onClick={() => setShowAdd(true)}>Add Department</Button>}
      >
        <DataTable>
          <THead>
            <TH>Name</TH>
            {hasDeptCode && <TH>Code</TH>}
            <TH>Head</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.name}</TD>
                {hasDeptCode && <TD className="text-content-variant">{d.code}</TD>}
                <TD>{d.head}</TD>
                <TD>
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={d.status === 'active' ? 'healthy' : 'neutral'}>{d.status}</Badge>
                    {d.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => setTarget({ id: d.id, name: d.name })}>
                        Disable
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
      <ConfirmDialog
        open={!!target}
        title="Disable department?"
        description={target ? `${target.name} will be disabled and hidden from new assignments.` : ''}
        confirmLabel="Disable"
        tone="danger"
        pending={disableMutation.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          disableMutation.mutate(target.id, {
            onSuccess: () => setTarget(null),
            onError: () => setTarget(null),
          })
        }
      />
    </>
  );
}

export function PositionsPage() {
  const query = usePositions();
  const departmentsQuery = useDepartments();
  const createMutation = useCreatePosition();
  const disableMutation = useDisablePosition();
  const [showAdd, setShowAdd] = useState(false);
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  const filtered = query.data ?? [];
  const departmentOptions = (departmentsQuery.data ?? []).filter((d) => d.status === 'active');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PositionFormValues>({ resolver: zodResolver(positionFormSchema) });

  const onCreate = (values: PositionFormValues) =>
    createMutation.mutate(values, {
      onSuccess: () => {
        reset();
        setShowAdd(false);
      },
    });

  return (
    <>
      <PageHeader
        title="Positions"
        description="Roles and reporting lines across departments"
        icon={<Briefcase className="size-5" />}
        actions={<Button onClick={() => setShowAdd((s) => !s)}>Add Position</Button>}
      />
      {showAdd && (
        <Card className="mb-6 max-w-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onCreate, () => notify.validationFailure())} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Title" htmlFor="pos-title" error={errors.title?.message}>
                <Input id="pos-title" aria-invalid={!!errors.title} {...register('title')} />
              </Field>
              <Field label="Code" htmlFor="pos-code" error={errors.code?.message}>
                <Input id="pos-code" aria-invalid={!!errors.code} {...register('code')} />
              </Field>
              <Field label="Department" htmlFor="pos-dept" error={errors.departmentId?.message}>
                <select
                  id="pos-dept"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  {...register('departmentId')}
                >
                  <option value="">Unassigned</option>
                  {departmentOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reports To" htmlFor="pos-reports">
                <Input id="pos-reports" {...register('reportsTo')} />
              </Field>
              <div className="col-span-full flex gap-2">
                <SubmitButton pending={createMutation.isPending} pendingLabel="Saving…">
                  Save Position
                </SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    reset();
                    setShowAdd(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <TableBoundary
        query={query}
        filtered={filtered}
        cols={5}
        emptyTitle="No positions yet"
        emptyDescription="Add positions to define roles and reporting lines in this workspace."
        emptyAction={<Button onClick={() => setShowAdd(true)}>Add Position</Button>}
      >
        <DataTable>
          <THead>
            <TH>Title</TH>
            <TH>Code</TH>
            <TH>Department</TH>
            <TH>Reports To</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium">{p.title}</TD>
                <TD className="text-content-variant">{p.code}</TD>
                <TD>{p.department}</TD>
                <TD>{p.reportsTo}</TD>
                <TD>
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={p.status === 'active' ? 'healthy' : 'neutral'}>{p.status}</Badge>
                    {p.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => setTarget({ id: p.id, title: p.title })}>
                        Disable
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
      <ConfirmDialog
        open={!!target}
        title="Disable position?"
        description={target ? `${target.title} will be disabled.` : ''}
        confirmLabel="Disable"
        tone="danger"
        pending={disableMutation.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          disableMutation.mutate(target.id, {
            onSuccess: () => setTarget(null),
            onError: () => setTarget(null),
          })
        }
      />
    </>
  );
}

// --- Updates: full installation state machine --------------------------------

/** Category badge tones for the workspace update cards. */
const UPDATE_CATEGORY_TONE: Record<PackageCategory, 'platform' | 'company' | 'warning' | 'role'> = {
  standard_package: 'platform',
  marketplace_extension: 'company',
  private_extension: 'warning',
  private_standalone: 'role',
};

export function UpdatesPage() {
  const companySlug = useCompanySlug();
  const query = useAvailableUpdates();
  const install = useInstallCompanyUpdate();
  // Per-card pending state: only the update being installed shows "Installing…".
  const installingId = install.isPending ? install.variables : undefined;
  const updates = query.data ?? [];

  return (
    <>
      <PageHeader title="Available Updates" description="Review and install updates assigned to your company" />
      {query.isPending ? (
        <PageLoadingState label="Loading updates…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : updates.length === 0 ? (
        <EmptyState
          title="Your packages are up to date"
          description="There are no pending system, marketplace, or private package updates."
          action={
            <Link to="/$companySlug/packages" params={{ companySlug }}>
              <Button variant="outline">View Installed Packages</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {updates.map((u) => {
            const isInstalling = installingId === u.installationId;
            const failed = u.installationState === 'failed';
            return (
              <Card key={u.installationId}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-content">{u.packageName}</h3>
                      <Badge tone={UPDATE_CATEGORY_TONE[u.category]}>{packageCategoryLabel(u.category)}</Badge>
                    </div>
                    {u.basePackageName && <p className="text-sm text-content-variant">Extends {u.basePackageName}</p>}
                    <p className="text-sm text-content-variant">
                      Installed: {u.installedVersion ?? '—'} · Available: {u.availableVersion}
                    </p>
                    {u.releaseNotes && <p className="text-sm">{u.releaseNotes}</p>}
                    {u.releasedAt && <p className="text-xs text-content-variant">Released {formatDate(u.releasedAt)}</p>}
                    {failed && <p className="text-sm text-danger">The previous attempt failed. You can retry.</p>}
                  </div>
                  <Button
                    onClick={() => install.mutate(u.installationId)}
                    disabled={isInstalling}
                    aria-label={`Install update for ${u.packageName}`}
                  >
                    {isInstalling ? 'Installing…' : failed ? 'Retry' : 'Install Update'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export function InstalledPackagesPage() {
  // Lifecycle-aware view: install state + retention, with actions gated by the
  // package category, the caller's role, and the current lifecycle state. All
  // mutations run through SECURITY DEFINER RPCs — never a direct Supabase call.
  const companyContext = useCompanyContext();
  const isCompanyAdmin = companyContext.data?.role === 'company_admin';
  return (
    <>
      <PageHeader
        title="Installed Packages"
        description="Manage the packages active in this workspace"
        icon={<Package className="size-5" />}
        actions={<Badge tone="neutral">Platform version: {APP_VERSION}</Badge>}
      />
      <InstalledPackagesPanel isCompanyAdmin={isCompanyAdmin} />
    </>
  );
}

export function UsersPage() {
  const tid = useTenantId();
  const query = useCompanyUsers(tid);
  const filtered = query.data ?? [];
  const activeCount = filtered.filter((u) => u.status === 'active').length;
  const adminCount = filtered.filter((u) => u.role === 'company_admin').length;
  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Company users and their roles"
        icon={<Users className="size-5" />}
      />
      {!query.isPending && !query.isError && filtered.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total users" value={filtered.length} icon={<Users className="size-5" />} accent="portal" />
          <StatCard label="Active" value={activeCount} hint="Currently enabled" />
          <StatCard label="Administrators" value={adminCount} hint="Company admin role" />
        </div>
      )}
      <TableBoundary query={query} filtered={filtered} cols={4}>
        <DataTable>
          <THead>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.fullName}</TD>
                <TD className="text-content-variant">{u.email}</TD>
                <TD className="capitalize">{u.role.replace(/_/g, ' ')}</TD>
                <TD>
                  <Badge tone={u.status === 'active' ? 'healthy' : 'neutral'}>{u.status}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

// --- Company Settings ---------------------------------------------------------

const settingsSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(6, 'Phone is required'),
});
type SettingsForm = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { company } = useSession();
  const companyContext = useCompanyContext();
  const tid = useTenantId();
  const mutation = useSaveSettings(tid);
  const companyName = company?.name ?? companyContext.data?.companyName ?? '';
  const companySubdomain = company?.subdomain ?? companyContext.data?.companySlug ?? '';
  const defaults = useMemo<SettingsForm>(
    () => ({ companyName, email: company?.adminEmail ?? '', phone: '+1 555 0100' }),
    [companyName, company?.adminEmail],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema), values: defaults });

  return (
    <>
      <PageHeader
        title="Company Settings"
        description="Basic company profile"
        icon={<SettingsIcon className="size-5" />}
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit((v) => mutation.mutate(v), () => notify.validationFailure())}
            className="space-y-4"
            noValidate
          >
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-surface-subtle text-content-variant">
                Logo
              </div>
              <p className="text-sm text-content-variant">Company logo placeholder</p>
            </div>
            <Field label="Company Name" htmlFor="companyName" error={errors.companyName?.message}>
              <Input id="companyName" aria-invalid={!!errors.companyName} {...register('companyName')} />
            </Field>
            <Field label="Company Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register('email')} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" aria-invalid={!!errors.phone} {...register('phone')} />
            </Field>
            <Field label="Subdomain" htmlFor="subdomain">
              <Input id="subdomain" value={companySubdomain} readOnly disabled />
            </Field>
            <SubmitButton pending={mutation.isPending} pendingLabel="Saving…">
              Save
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

// --- Optional package modules (gated) ----------------------------------------

export function LeavePage() {
  // Route-level entitlement gate (Beta has no Leave package). RLS still enforces
  // access on the server; this is the UX boundary.
  return (
    <PackageGuard packageCode={PACKAGE_CODES.leave} packageName="Leave Management">
      <LeaveContent />
    </PackageGuard>
  );
}

const selectClass =
  'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-color,#3525cd)] focus-visible:ring-offset-1 ' +
  'aria-[invalid=true]:border-danger';

const leaveTone = (s: LeaveRequest['status']) =>
  s === 'approved' ? 'healthy' : s === 'rejected' || s === 'cancelled' ? 'offline' : 'degraded';

function LeaveContent() {
  const query = useLeaveRequests();
  const employeesQuery = useEmployees();
  const createMutation = useCreateLeaveRequest();
  const decideMutation = useDecideLeaveRequest();
  const [showAdd, setShowAdd] = useState(false);
  const filtered = query.data ?? [];
  const assignableEmployees = (employeesQuery.data ?? []).filter((e) => e.status !== 'terminated');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: { leaveType: 'annual' },
  });

  const onCreate = (values: LeaveRequestFormValues) =>
    createMutation.mutate(values, {
      onSuccess: () => {
        reset({ leaveType: 'annual' });
        setShowAdd(false);
      },
    });

  const decide = (l: LeaveRequest, status: 'approved' | 'rejected' | 'cancelled') =>
    decideMutation.mutate({ id: l.id, current: l.status, status });

  return (
    <>
      <PageHeader
        title="Leave Management"
        actions={<Button onClick={() => setShowAdd((s) => !s)}>Add Request</Button>}
      />
      {showAdd && (
        <Card className="mb-6 max-w-3xl">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit(onCreate, () => notify.validationFailure())}
              className="grid gap-4 sm:grid-cols-2"
              noValidate
            >
              <Field label="Employee" htmlFor="leave-employee" error={errors.employeeId?.message}>
                <select
                  id="leave-employee"
                  className={selectClass}
                  aria-invalid={!!errors.employeeId}
                  defaultValue=""
                  {...register('employeeId')}
                >
                  <option value="" disabled>
                    Select employee…
                  </option>
                  {assignableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type" htmlFor="leave-type" error={errors.leaveType?.message}>
                <select id="leave-type" className={selectClass} {...register('leaveType')}>
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </Field>
              <Field label="Start date" htmlFor="leave-start" error={errors.startDate?.message}>
                <Input id="leave-start" type="date" aria-invalid={!!errors.startDate} {...register('startDate')} />
              </Field>
              <Field label="End date" htmlFor="leave-end" error={errors.endDate?.message}>
                <Input id="leave-end" type="date" aria-invalid={!!errors.endDate} {...register('endDate')} />
              </Field>
              <Field label="Reason (optional)" htmlFor="leave-reason" className="sm:col-span-2">
                <Input id="leave-reason" {...register('reason')} />
              </Field>
              <div className="col-span-full flex gap-2">
                <SubmitButton pending={createMutation.isPending} pendingLabel="Saving…">
                  Submit Request
                </SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    reset({ leaveType: 'annual' });
                    setShowAdd(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <TableBoundary query={query} filtered={filtered} cols={6} emptyTitle="No leave requests">
        <DataTable>
          <THead>
            <TH>Employee</TH>
            <TH>Type</TH>
            <TH>Start</TH>
            <TH>End</TH>
            <TH>Status</TH>
            <TH>Action</TH>
          </THead>
          <TBody>
            {filtered.map((l) => (
              <TR key={l.id}>
                <TD className="font-medium">{l.employee}</TD>
                <TD className="capitalize">{l.leaveType}</TD>
                <TD>{l.startDate}</TD>
                <TD>{l.endDate}</TD>
                <TD>
                  <Badge tone={leaveTone(l.status)}>{l.status}</Badge>
                </TD>
                <TD>
                  {l.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" disabled={decideMutation.isPending} onClick={() => decide(l, 'approved')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" disabled={decideMutation.isPending} onClick={() => decide(l, 'rejected')}>
                        Reject
                      </Button>
                      <Button size="sm" variant="ghost" disabled={decideMutation.isPending} onClick={() => decide(l, 'cancelled')}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-content-variant">—</span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function AttendancePage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.attendance} minVersion="1.0.0" packageName="Attendance Management">
      <AttendanceContent />
    </PackageGuard>
  );
}

const attendanceTone = (s: AttendanceRecord['status']) =>
  s === 'present' ? 'healthy' : s === 'late' ? 'degraded' : 'offline';

function AttendanceContent() {
  const query = useAttendanceRecords();
  const employeesQuery = useEmployees();
  const createMutation = useCreateAttendance();
  const checkOutMutation = useCheckOutAttendance();
  const [showAdd, setShowAdd] = useState(false);
  const filtered = query.data ?? [];
  const assignableEmployees = (employeesQuery.data ?? []).filter((e) => e.status !== 'terminated');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      status: 'present',
      date: new Date().toISOString().slice(0, 10),
      checkIn: new Date().toTimeString().slice(0, 5),
    },
  });
  const status = watch('status');

  const onCreate = (values: AttendanceFormValues) =>
    createMutation.mutate(values, {
      onSuccess: () => {
        reset();
        setShowAdd(false);
      },
    });

  return (
    <>
      <PageHeader
        title="Attendance Management"
        actions={<Button onClick={() => setShowAdd((s) => !s)}>Add Attendance</Button>}
      />
      {showAdd && (
        <Card className="mb-6 max-w-3xl">
          <CardContent className="pt-6">
            <form
              onSubmit={handleSubmit(onCreate, () => notify.validationFailure())}
              className="grid gap-4 sm:grid-cols-2"
              noValidate
            >
              <Field label="Employee" htmlFor="att-employee" error={errors.employeeId?.message}>
                <select
                  id="att-employee"
                  className={selectClass}
                  aria-invalid={!!errors.employeeId}
                  defaultValue=""
                  {...register('employeeId')}
                >
                  <option value="" disabled>
                    Select employee…
                  </option>
                  {assignableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" htmlFor="att-date" error={errors.date?.message}>
                <Input id="att-date" type="date" aria-invalid={!!errors.date} {...register('date')} />
              </Field>
              <Field label="Status" htmlFor="att-status" error={errors.status?.message}>
                <select id="att-status" className={selectClass} {...register('status')}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </Field>
              {status !== 'absent' && (
                <Field label="Check-in time" htmlFor="att-checkin" error={errors.checkIn?.message}>
                  <Input id="att-checkin" type="time" aria-invalid={!!errors.checkIn} {...register('checkIn')} />
                </Field>
              )}
              <Field label="Notes (optional)" htmlFor="att-notes" className="sm:col-span-2">
                <Input id="att-notes" {...register('notes')} />
              </Field>
              <div className="col-span-full flex gap-2">
                <SubmitButton pending={createMutation.isPending} pendingLabel="Saving…">
                  Save Attendance
                </SubmitButton>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    reset();
                    setShowAdd(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <TableBoundary query={query} filtered={filtered} cols={7} emptyTitle="No attendance records">
        <DataTable>
          <THead>
            <TH>Employee</TH>
            <TH>Date</TH>
            <TH>Check-in</TH>
            <TH>Check-out</TH>
            <TH>Total Hours</TH>
            <TH>Status</TH>
            <TH>Action</TH>
          </THead>
          <TBody>
            {filtered.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.employee}</TD>
                <TD>{a.date}</TD>
                <TD>{a.checkIn || '—'}</TD>
                <TD>{a.checkOut || '—'}</TD>
                <TD>{a.totalHours || '—'}</TD>
                <TD>
                  <Badge tone={attendanceTone(a.status)}>{a.status}</Badge>
                </TD>
                <TD>
                  {canCheckOut(a) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={checkOutMutation.isPending}
                      onClick={() => checkOutMutation.mutate(a)}
                    >
                      Check out
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
    </>
  );
}

// --- Extensions Marketplace (company self-service) ---------------------------

export function MarketplacePage() {
  const query = useMarketplacePackages();
  const { codes, packages } = usePackageEntitlements();
  const context = useCompanyContext();
  const isAdmin = context.data?.role === 'company_admin';
  const install = useInstallMarketplaceExtension();
  // Pending state is package-specific: only the card being installed shows it.
  const installingKey = install.isPending ? install.variables : undefined;
  // Install is never immediate — it opens an impact/diagnostics review first.
  const [reviewing, setReviewing] = useState<{ code: string; name: string; version: string } | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('All');
  const items = query.data ?? [];
  const filtered = items.filter((p) => {
    if (category !== 'All' && marketplaceCategory(p.code) !== category) return false;
    return `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      <PageHeader
        icon={<Store className="size-5" />}
        title="Extensions Marketplace"
        description="Discover optional features your company can install."
        actions={
          <div className="relative w-full sm:w-64">
            <Input placeholder="Search extensions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search extensions" />
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {MARKETPLACE_CATEGORIES.map((c) => (
          <Button key={c} size="sm" variant={category === c ? undefined : 'outline'} onClick={() => setCategory(c)}>
            {c}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <PageLoadingState label="Loading marketplace…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState title="No extensions available" description="Published marketplace extensions will appear here." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching extensions" description="Try a different search or category." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => {
            const installed = codes.includes(p.code);
            const version = packages.find((x) => x.code === p.code)?.version ?? null;
            const isInstalling = installingKey === p.code;
            const openRoute = PACKAGE_MANIFEST[p.code as PackageKey]?.features[0]?.route;
            const features = packageFeatureLabels(p.code as PackageKey);
            return (
              <Card key={p.code} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{p.name}</CardTitle>
                    <Badge tone="neutral">{marketplaceCategory(p.code)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {p.featureStatus === 'catalog_only' && (
                    <Badge tone="warning">Feature implementation pending</Badge>
                  )}
                  {p.description && <p className="text-sm text-content-variant">{p.description}</p>}
                  {features.length > 0 && (
                    <ul className="space-y-1 text-sm text-content-variant">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-status-healthy" aria-hidden />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <Badge tone="neutral">Latest {p.latestVersion ?? '—'}</Badge>
                    {installed && version && <Badge tone="healthy">Installed · {version}</Badge>}
                  </div>
                  {installed ? (
                    openRoute && (
                      <Link to={openRoute}>
                        <Button variant="secondary" aria-label={`Open ${p.name}`}>Open</Button>
                      </Link>
                    )
                  ) : isAdmin ? (
                    <Button
                      onClick={() => setReviewing({ code: p.code, name: p.name, version: p.latestVersion ?? '1.0.0' })}
                      disabled={isInstalling}
                      aria-label={`Install ${p.name}`}
                    >
                      {isInstalling ? 'Installing…' : 'Install'}
                    </Button>
                  ) : (
                    <p className="text-sm text-content-variant">Ask a company admin to install this extension.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {reviewing && (
        <PackageReviewDialog
          open
          mode="install"
          packageName={reviewing.name}
          category="marketplace_extension"
          manifest={reviewManifest(reviewing.code, reviewing.version)}
          pending={install.isPending}
          onCancel={() => setReviewing(null)}
          onConfirm={() =>
            install.mutate(reviewing.code, {
              onSuccess: () => setReviewing(null),
              onError: () => setReviewing(null),
            })
          }
        />
      )}
    </>
  );
}

/** The impact manifest to review, or a safe minimal fallback for packages that
 *  have not published a structured manifest yet (diagnostics still PASS-gated). */
function reviewManifest(packageKey: string, version: string): PackageImpactManifest {
  return (
    latestImpactManifest(packageKey) ?? {
      version,
      frontend: {},
      backend: {},
      data: { notes: ['Creates company-owned records; uninstall retains them for 30 days.'] },
      dependencies: { minimumPlatformVersion: APP_VERSION },
      migrations: { required: true, reversible: true },
      rollback: { supported: false },
      retention: { policy: 'retain_then_purge', retentionDays: 30 },
      diagnostics: { status: 'PASS' },
    }
  );
}

export function AnnouncementsPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.companyAnnouncements} packageName="Company Announcements">
      <AnnouncementsContent />
    </PackageGuard>
  );
}

function AnnouncementsContent() {
  const query = useAnnouncements();
  const create = useCreateAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const items = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { title, body: body || undefined },
      {
        onSuccess: () => { setTitle(''); setBody(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not post the announcement.'),
      },
    );
  };

  return (
    <>
      <PageHeader
        icon={<Megaphone className="size-5" />}
        title="Company Announcements"
        description="Broadcast announcements to your workspace"
      />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Title" htmlFor="announcement-title">
              <Input id="announcement-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Message" htmlFor="announcement-body">
              <textarea id="announcement-body" className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <SubmitButton pending={create.isPending} pendingLabel="Posting…">Post Announcement</SubmitButton>
          </form>
        </CardContent>
      </Card>
      {query.isPending ? (
        <PageLoadingState label="Loading announcements…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState title="No announcements yet" description="Post your first announcement above." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <CardTitle className="text-base">{a.title}</CardTitle>
                <span className="shrink-0 text-xs text-content-variant">{formatDate(a.createdAt)}</span>
              </CardHeader>
              {a.body && (
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-content-variant">{a.body}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function AssetRegisterPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.assetRegister} packageName="Asset Register">
      <AssetRegisterContent />
    </PackageGuard>
  );
}

function AssetRegisterContent() {
  const query = useAssets();
  const create = useCreateAsset();
  const [name, setName] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState<string>();
  const assets = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { name, assetTag: assetTag || undefined, assignedTo: assignedTo || undefined },
      {
        onSuccess: () => { setName(''); setAssetTag(''); setAssignedTo(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not add the asset.'),
      },
    );
  };

  return (
    <>
      <PageHeader
        icon={<Boxes className="size-5" />}
        title="Asset Register"
        description="Track company assets and their assignments"
      />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3" noValidate>
            <Field label="Name" htmlFor="asset-name">
              <Input id="asset-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Asset Tag" htmlFor="asset-tag">
              <Input id="asset-tag" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
            </Field>
            <Field label="Assigned To" htmlFor="asset-assignee">
              <Input id="asset-assignee" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </Field>
            <div className="col-span-full">
              <SubmitButton pending={create.isPending} pendingLabel="Adding…">Add Asset</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
      <TableBoundary query={query} filtered={assets} cols={4} emptyTitle="No assets yet" emptyDescription="Add your first asset above.">
        <DataTable>
          <THead>
            <TH>Name</TH>
            <TH>Tag</TH>
            <TH>Assigned To</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {assets.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name}</TD>
                <TD className="text-content-variant">{a.assetTag || '—'}</TD>
                <TD>{a.assignedTo || '—'}</TD>
                <TD>
                  <Badge tone={a.status === 'available' ? 'healthy' : a.status === 'assigned' ? 'company' : 'neutral'} className="capitalize">
                    {a.status}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function PulseSurveysPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.pulseSurveys} packageName="Pulse Surveys">
      <PulseSurveysContent />
    </PackageGuard>
  );
}

function PulseSurveysContent() {
  const query = usePulseSurveys();
  const create = useCreatePulseSurvey();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const surveys = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { question, description: description || undefined },
      {
        onSuccess: () => { setQuestion(''); setDescription(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not create the survey.'),
      },
    );
  };

  return (
    <>
      <PageHeader
        icon={<Gauge className="size-5" />}
        title="Pulse Surveys"
        description="Run short, recurring employee pulse surveys"
      />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Question" htmlFor="survey-question">
              <Input id="survey-question" required value={question} onChange={(e) => setQuestion(e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="survey-description">
              <textarea id="survey-description" className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <SubmitButton pending={create.isPending} pendingLabel="Creating…">Create Survey</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <TableBoundary query={query} filtered={surveys} cols={3} emptyTitle="No surveys yet" emptyDescription="Create your first pulse survey above.">
        <DataTable>
          <THead>
            <TH>Question</TH>
            <TH>Status</TH>
            <TH>Created</TH>
          </THead>
          <TBody>
            {surveys.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.question}</TD>
                <TD>
                  <Badge tone={s.status === 'active' ? 'healthy' : 'neutral'} className="capitalize">{s.status}</Badge>
                </TD>
                <TD className="text-content-variant">{formatDate(s.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
    </>
  );
}

export function OrgChartPage() {
  // System Tool: a read-only visualization over HR Core data. It owns no data of
  // its own; HR Core's RLS governs what the viewer can read.
  return (
    <PackageGuard packageCode={PACKAGE_CODES.orgChart} packageName="Org Chart Viewer">
      <OrgChartContent />
    </PackageGuard>
  );
}

function OrgChartContent() {
  const departments = useDepartments();
  const positions = usePositions();
  const employees = useEmployees();

  if (departments.isPending || positions.isPending || employees.isPending) {
    return <PageLoadingState label="Building org chart…" />;
  }
  if (departments.isError || positions.isError || employees.isError) {
    return <ErrorState onRetry={() => { departments.refetch(); positions.refetch(); employees.refetch(); }} />;
  }

  const activeDepartments = (departments.data ?? []).filter((d) => d.status === 'active');
  const allPositions = (positions.data ?? []).filter((p) => p.status === 'active');
  const allEmployees = employees.data ?? [];
  const positionsFor = (deptName: string) => allPositions.filter((p) => p.department === deptName);
  const headcountFor = (deptName: string) => allEmployees.filter((e) => e.department === deptName).length;

  return (
    <>
      <PageHeader
        icon={<Network className="size-5" />}
        title="Org Chart Viewer"
        description="Your organization structure, derived from HR Core"
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Departments" value={activeDepartments.length} icon={<Building className="size-5" />} accent="portal" />
        <StatCard label="Positions" value={allPositions.length} icon={<Briefcase className="size-5" />} />
        <StatCard label="Employees" value={allEmployees.length} icon={<Users className="size-5" />} />
      </div>
      {activeDepartments.length === 0 ? (
        <EmptyState title="No departments yet" description="Add departments and positions in HR Core to see the org chart." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {activeDepartments.map((d) => {
            const deptPositions = positionsFor(d.name);
            return (
              <Card key={d.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>{d.name}</CardTitle>
                    {d.head && <p className="mt-1 text-sm text-content-variant">Head: {d.head}</p>}
                  </div>
                  <Badge tone="neutral">{headcountFor(d.name)} {headcountFor(d.name) === 1 ? 'person' : 'people'}</Badge>
                </CardHeader>
                <CardContent>
                  {deptPositions.length === 0 ? (
                    <p className="text-sm text-content-variant">No positions defined.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {deptPositions.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3">
                          <span className="font-medium text-content">{p.title}</span>
                          {p.reportsTo && <span className="text-xs text-content-variant">reports to {p.reportsTo}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export function DocumentNotesPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.documentNotes} packageName="Document Notes">
      <DocumentNotesContent />
    </PackageGuard>
  );
}

function DocumentNotesContent() {
  const query = useDocumentNotes();
  const create = useCreateDocumentNote();
  const { packages } = usePackageEntitlements();
  // The note category field is introduced in Document Notes 1.1.0.
  const showCategory = hasFeature(packages, PACKAGE_CODES.documentNotes, '1.1.0');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string>();
  const notes = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { title, description, category: showCategory ? category || undefined : undefined },
      {
        onSuccess: () => { setTitle(''); setDescription(''); setCategory(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not add the note.'),
      },
    );
  };

  return (
    <>
      <PageHeader title="Document Notes" description="Simple notes for your company" />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Title">
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Description">
              <textarea className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {showCategory && (
              <Field label="Category">
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </Field>
            )}
            <SubmitButton pending={create.isPending} pendingLabel="Adding…">Add Note</SubmitButton>
          </form>
        </CardContent>
      </Card>
      {query.isPending ? (
        <PageLoadingState label="Loading notes…" />
      ) : notes.length === 0 ? (
        <EmptyState title="No notes yet" description="Add your first note above." />
      ) : (
        <DataTable>
          <THead>
            <TH>Title</TH>
            <TH>Description</TH>
            {showCategory && <TH>Category</TH>}
          </THead>
          <TBody>
            {notes.map((n) => (
              <TR key={n.id}>
                <TD className="font-medium">{n.title}</TD>
                <TD className="text-content-variant">{n.description}</TD>
                {showCategory && <TD>{n.category ?? '—'}</TD>}
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </>
  );
}

export function ExpenseRequestsPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.expenseRequests} packageName="Expense Requests">
      <ExpenseRequestsContent />
    </PackageGuard>
  );
}

function ExpenseRequestsContent() {
  const query = useExpenseRequests();
  const create = useCreateExpenseRequest();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const rows = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { amount: Number(amount), description },
      {
        onSuccess: () => { setAmount(''); setDescription(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not create the request.'),
      },
    );
  };

  return (
    <>
      <PageHeader title="Expense Requests" description="Simple expense requests for your company" />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Amount">
              <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Description">
              <textarea className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <SubmitButton pending={create.isPending} pendingLabel="Submitting…">Create Request</SubmitButton>
          </form>
        </CardContent>
      </Card>
      {query.isPending ? (
        <PageLoadingState label="Loading requests…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No expense requests yet" description="Create your first request above." />
      ) : (
        <DataTable>
          <THead>
            <TH>Amount</TH>
            <TH>Description</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.amount.toFixed(2)}</TD>
                <TD className="text-content-variant">{r.description}</TD>
                <TD><Badge tone="neutral">{r.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </>
  );
}

export function VisitorRegisterPage() {
  return (
    <PackageGuard packageCode={PACKAGE_CODES.visitorRegister} packageName="Custom Visitor Register">
      <VisitorRegisterContent />
    </PackageGuard>
  );
}

function VisitorRegisterContent() {
  const query = useVisitorEntries();
  const create = useCreateVisitor();
  const [visitorName, setVisitorName] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('');
  const [error, setError] = useState<string>();
  const rows = query.data ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { visitorName, visitPurpose },
      {
        onSuccess: () => { setVisitorName(''); setVisitPurpose(''); },
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not add the visitor.'),
      },
    );
  };

  return (
    <>
      <PageHeader title="Visitor Register" description="Simple visitor register for your company" />
      <Card className="mb-6 max-w-2xl">
        <CardContent className="pt-6">
          {error && <div role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Visitor name">
              <Input required value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
            </Field>
            <Field label="Visit purpose">
              <Input value={visitPurpose} onChange={(e) => setVisitPurpose(e.target.value)} />
            </Field>
            <SubmitButton pending={create.isPending} pendingLabel="Adding…">Add Visitor</SubmitButton>
          </form>
        </CardContent>
      </Card>
      {query.isPending ? (
        <PageLoadingState label="Loading visitors…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No visitors yet" description="Add your first visitor above." />
      ) : (
        <DataTable>
          <THead>
            <TH>Visitor</TH>
            <TH>Purpose</TH>
          </THead>
          <TBody>
            {rows.map((v) => (
              <TR key={v.id}>
                <TD className="font-medium">{v.visitorName}</TD>
                <TD className="text-content-variant">{v.visitPurpose}</TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      )}
    </>
  );
}
