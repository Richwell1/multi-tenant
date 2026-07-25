import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Circle } from 'lucide-react';
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
import { PackageGuard } from '@/components/guards';
import { useHasPackage } from '@/hooks/entitlements';
import { PACKAGE_CODES } from '@/lib/entitlements';
import { notify } from '@/lib/notify';
import { forceNextFailure } from '@/data/api';
import {
  useCompanyUsers,
  useInstallPackage,
  useSaveSettings,
  useTenantInstallations,
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
  const { tenantId } = useSession();
  return tenantId ?? 'alpha';
}

// --- Dashboard ----------------------------------------------------------------

export function WorkspaceDashboard() {
  const { company } = useSession();
  const hasLeave = useHasPackage(PACKAGE_CODES.leave);
  const employees = useEmployees();
  const departments = useDepartments();
  const positions = usePositions();

  if (employees.isPending) return <PageLoadingState label={`Loading ${company?.name ?? 'workspace'}…`} />;
  if (employees.isError)
    return <ErrorState onRetry={() => employees.refetch()} retrying={employees.isFetching} />;

  return (
    <>
      <PageHeader
        title={`${company?.name ?? 'Company'} Dashboard`}
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
  const [q, setQ] = useState('');
  const query = useEmployees();
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

const departmentSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  head: z.string().optional(),
});
type DepartmentForm = z.infer<typeof departmentSchema>;

export function DepartmentsPage() {
  const query = useDepartments();
  const createMutation = useCreateDepartment();
  const disableMutation = useDisableDepartment();
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
              <Field label="Code" htmlFor="dept-code" error={errors.code?.message}>
                <Input id="dept-code" aria-invalid={!!errors.code} {...register('code')} />
              </Field>
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
      <TableBoundary query={query} filtered={filtered} cols={4}>
        <DataTable>
          <THead>
            <TH>Name</TH>
            <TH>Code</TH>
            <TH>Head</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.name}</TD>
                <TD className="text-content-variant">{d.code}</TD>
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
  const tid = useTenantId();
  const install = useInstallPackage();
  const [phase, setPhase] = useState<InstallationPhase>('available');
  const [step, setStep] = useState(0);
  const [forceFail, setForceFail] = useState(false);

  // Candidate package for this workspace demo (all-company standard update).
  const target = 'attendance-management' as const;
  const packageName = 'Attendance Management 1.0.0';

  const runInstall = () => {
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
                  <p className="text-content-variant">Confirm activation for {company?.name}. This applies the package to your workspace.</p>
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
        description={`${packageName} will be installed into ${company?.name ?? 'this workspace'}.`}
        confirmLabel="Install now"
        pending={install.isPending}
        onCancel={() => setPhase('available')}
        onConfirm={runInstall}
      />
    </>
  );
}

export function InstalledPackagesPage() {
  const tid = useTenantId();
  const query = useTenantInstallations(tid);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Installed Packages" description="Packages active in this workspace" />
      <TableBoundary query={query} filtered={filtered} cols={3}>
        <DataTable>
          <THead>
            <TH>Package</TH>
            <TH>Version</TH>
            <TH>State</TH>
          </THead>
          <TBody>
            {filtered.map((i) => (
              <TR key={i.id}>
                <TD className="font-medium">{i.packageKey}</TD>
                <TD>{i.packageVersion}</TD>
                <TD>
                  <Badge tone={i.state === 'installed' ? 'healthy' : 'degraded'}>{i.state}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
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
  const tid = useTenantId();
  const mutation = useSaveSettings(tid);
  const defaults = useMemo<SettingsForm>(
    () => ({ companyName: company?.name ?? '', email: company?.adminEmail ?? '', phone: '+1 555 0100' }),
    [company],
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
              <Input id="subdomain" value={company?.subdomain ?? ''} readOnly disabled />
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
    <PackageGuard packageCode={PACKAGE_CODES.attendance} packageName="Attendance Management">
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
