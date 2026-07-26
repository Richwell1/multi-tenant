import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { APP_VERSION } from '@/lib/app-version';
import { PACKAGE_MANIFEST, availableFeatures, hasFeature } from '@/lib/packages/manifest';
import type { PackageKey } from '@/data/types';
import { useMarketplacePackages, useInstallMarketplaceExtension } from '@/hooks/marketplace';
import { useDocumentNotes, useCreateDocumentNote } from '@/hooks/document-notes';
import { useExpenseRequests, useCreateExpenseRequest } from '@/hooks/expense-requests';
import { useVisitorEntries, useCreateVisitor } from '@/hooks/visitor-register';
import { RepositoryError } from '@/data/errors';
import { StatCard } from '@/components/stat-card';
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
  InstallationProgress,
  InstallationSuccess,
  InstallationFailure,
  type InstallationPhase,
} from '@/components/states';
import { useSession } from '@/lib/session';
import { useCompanyId } from '@/hooks/use-company-id';
import { useCompanyContext } from '@/hooks/context';
import { PackageGuard } from '@/components/guards';
import { useHasPackage, usePackageEntitlements } from '@/hooks/entitlements';
import { PACKAGE_CODES } from '@/lib/entitlements';
import { notify } from '@/lib/notify';
import { forceNextFailure } from '@/data/api';
import {
  useCompanyUsers,
  useInstallPackage,
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
  const hasLeave = useHasPackage(PACKAGE_CODES.leave);
  const employees = useEmployees();
  const departments = useDepartments();
  const positions = usePositions();

  if (employees.isPending) return <PageLoadingState label={`Loading ${companyName}…`} />;
  if (employees.isError)
    return <ErrorState onRetry={() => employees.refetch()} retrying={employees.isFetching} />;

  return (
    <>
      <PageHeader
        title={`${companyName} Dashboard`}
        description={hasLeave ? 'HR Core + Leave Management' : 'HR Core'}
        actions={<Badge tone="company">{hasLeave ? 'Leave enabled' : 'Core only'}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={employees.data.length} />
        <StatCard label="Departments" value={departments.data?.length ?? '—'} />
        <StatCard label="Positions" value={positions.data?.length ?? '—'} />
        <StatCard label="Leave" value={hasLeave ? 'Enabled' : '—'} />
      </div>
      {hasLeave && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Leave Management</CardTitle>
            <Badge tone="company">Active package</Badge>
          </CardHeader>
          <CardContent className="text-sm text-content-variant">
            Leave Management is enabled for this workspace.{' '}
            <Link to="/leave" className="text-company hover:underline">
              Open Leave
            </Link>
          </CardContent>
        </Card>
      )}
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
            <Link to="/employees/new">
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
                  <Link to="/employees/$employeeId" params={{ employeeId: e.id }} className="font-medium text-company hover:underline">
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
    mutation.mutate(values, { onSuccess: () => navigate({ to: '/employees' }) });

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
              <Link to="/employees">
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
      <TableBoundary query={query} filtered={filtered} cols={hasDeptCode ? 4 : 3}>
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
      <TableBoundary query={query} filtered={filtered} cols={5}>
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

const WIZARD_STEPS = ['Review', 'Impact', 'Confirm', 'Install'] as const;

export function UpdatesPage() {
  const { company } = useSession();
  const companyContext = useCompanyContext();
  const companyName = company?.name ?? companyContext.data?.companyName ?? 'this workspace';
  const tid = useTenantId();
  const install = useInstallPackage();
  const [phase, setPhase] = useState<InstallationPhase>('available');
  const [step, setStep] = useState(0);
  const [forceFail, setForceFail] = useState(false);

  // Candidate package for this workspace demo (all-company standard update).
  const target = 'attendance-management' as const;
  const packageName = 'Attendance Management 1.0.0';

  const runInstall = () => {
    if (!tid) return;
    setPhase('installing');
    notify.updateStarted(packageName);
    if (forceFail) forceNextFailure('install');
    install.mutate(
      { packageKey: target, companyId: tid },
      {
        onSuccess: () => {
          setPhase('installed');
          notify.updateInstalled(packageName);
        },
        onError: () => {
          setPhase('failed');
          notify.updateFailed(packageName);
        },
      },
    );
  };

  const reset = () => {
    setPhase('available');
    setStep(0);
  };

  return (
    <>
      <PageHeader title="Available Updates" description="Review and activate assigned packages" />

      {(phase === 'available' || phase === 'pending_confirmation') && (
        <Card>
          <CardContent className="pt-6">
            <ol className="flex flex-wrap gap-6">
              {WIZARD_STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {i < step ? (
                    <CheckCircle2 className="size-5 text-company" />
                  ) : (
                    <Circle className={i === step ? 'size-5 text-company' : 'size-5 text-content-variant/40'} />
                  )}
                  <span className={i === step ? 'font-medium text-content' : 'text-content-variant'}>{label}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 text-sm">
              {step === 0 && (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span>{packageName}</span>
                  <Badge tone="company">standard update</Badge>
                </div>
              )}
              {step === 1 && (
                <ul className="space-y-1 text-content-variant">
                  <li>• Adds an Attendance entry to the sidebar</li>
                  <li>• Creates the attendance_records table</li>
                  <li>• Requires the packages.activate permission</li>
                </ul>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-content-variant">Confirm activation for {companyName}. This applies the package to your workspace.</p>
                  <label className="flex items-center gap-2 text-xs text-content-variant">
                    <input type="checkbox" checked={forceFail} onChange={(e) => setForceFail(e.target.checked)} />
                    Simulate a failed installation (demo)
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              {step > 0 && (
                <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {step < 2 && <Button onClick={() => setStep((s) => s + 1)}>Next</Button>}
              {step === 2 && (
                <Button onClick={() => setPhase('pending_confirmation')}>Activate Update</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {phase === 'installing' && <InstallationProgress packageName={packageName} />}
      {phase === 'installed' && <InstallationSuccess packageName={packageName} onDone={reset} />}
      {phase === 'failed' && (
        <InstallationFailure
          packageName={packageName}
          reason="A network error interrupted the installation. No changes were applied."
          onRetry={runInstall}
          retrying={install.isPending}
        />
      )}

      <ConfirmDialog
        open={phase === 'pending_confirmation'}
        title="Install update?"
        description={`${packageName} will be installed into ${companyName}.`}
        confirmLabel="Install now"
        pending={install.isPending}
        onCancel={() => setPhase('available')}
        onConfirm={runInstall}
      />
    </>
  );
}

export function InstalledPackagesPage() {
  // Single source: the resolved company context (enabled packages + installed
  // versions). Feature lists come from the centralized package manifest — package
  // versions are never hardcoded per component and stay separate from APP_VERSION.
  const { packages, isPending, isError } = usePackageEntitlements();
  return (
    <>
      <PageHeader
        title="Installed Packages"
        description="Packages active in this workspace"
        actions={<Badge tone="neutral">Platform version: {APP_VERSION}</Badge>}
      />
      {isPending ? (
        <PageLoadingState label="Loading installed packages…" />
      ) : isError ? (
        <ErrorState />
      ) : packages.length === 0 ? (
        <EmptyState title="No packages installed" description="Installed packages will appear here once a release reaches this company." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((p) => {
            const entry = PACKAGE_MANIFEST[p.code as PackageKey];
            const features = availableFeatures(packages, p.code as PackageKey);
            return (
              <Card key={p.code}>
                <CardHeader>
                  <CardTitle>{entry?.name ?? p.code}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge tone="neutral">Version {p.version ?? '—'}</Badge>
                  {features.length > 0 && (
                    <ul className="space-y-1 text-sm text-content-variant">
                      {features.map((f) => (
                        <li key={f.label} className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-status-healthy" />
                          {f.label}
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

export function UsersPage() {
  const tid = useTenantId();
  const query = useCompanyUsers(tid);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Users & Roles" description="Company users and their roles" />
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
      <PageHeader title="Company Settings" description="Basic company profile" />
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
  const items = query.data ?? [];
  return (
    <>
      <PageHeader title="Extensions Marketplace" description="Optional standalone features your company can install" />
      {query.isPending ? (
        <PageLoadingState label="Loading marketplace…" />
      ) : query.isError ? (
        <ErrorState />
      ) : items.length === 0 ? (
        <EmptyState title="No extensions available" description="Published marketplace extensions will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((p) => {
            const installed = codes.includes(p.code);
            const installedVersion = packages.find((x) => x.code === p.code)?.version ?? null;
            const isInstalling = installingKey === p.code;
            const openRoute = PACKAGE_MANIFEST[p.code as PackageKey]?.features[0]?.route;
            return (
              <Card key={p.code}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {p.description && <p className="text-sm text-content-variant">{p.description}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">Latest {p.latestVersion ?? '—'}</Badge>
                    {installed && installedVersion && <Badge tone="healthy">Installed · {installedVersion}</Badge>}
                  </div>
                  {installed ? (
                    openRoute && (
                      <Link to={openRoute}>
                        <Button variant="secondary" aria-label={`Open ${p.name}`}>Open</Button>
                      </Link>
                    )
                  ) : isAdmin ? (
                    <Button onClick={() => install.mutate(p.code)} disabled={isInstalling} aria-label={`Install ${p.name}`}>
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
