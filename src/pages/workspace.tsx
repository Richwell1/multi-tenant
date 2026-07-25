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
  PackageUnavailableState,
  ConfirmDialog,
  InstallationProgress,
  InstallationSuccess,
  InstallationFailure,
  type InstallationPhase,
} from '@/components/states';
import { useSession } from '@/lib/session';
import { canAccessAttendance, canAccessLeave } from '@/lib/tenant';
import { notify } from '@/lib/notify';
import { forceNextFailure } from '@/data/api';
import {
  useAttendance,
  useCompanyUsers,
  useCreateEmployee,
  useEmployee,
  useEmployees,
  useInstallPackage,
  useLeaveRequests,
  usePositions,
  useSaveSettings,
  useTenantInstallations,
} from '@/hooks/queries';
import { useDepartments, useCreateDepartment, useDisableDepartment } from '@/hooks/departments';

function useTenantId() {
  const { tenantId } = useSession();
  return tenantId ?? 'alpha';
}

// --- Dashboard ----------------------------------------------------------------

export function WorkspaceDashboard() {
  const { company } = useSession();
  const tid = useTenantId();
  const hasLeave = canAccessLeave(company);
  const employees = useEmployees(tid);
  const departments = useDepartments();
  const positions = usePositions(tid);

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
  const tid = useTenantId();
  const [q, setQ] = useState('');
  const query = useEmployees(tid);
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
            <Input className="w-56" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
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

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, 'Required'),
  fullName: z.string().min(2, 'Required'),
  workEmail: z.string().email('Valid email required'),
  department: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  employmentType: z.enum(['full_time', 'part_time', 'contract']),
});
type EmployeeForm = z.infer<typeof employeeSchema>;

export function AddEmployee() {
  const navigate = useNavigate();
  const tid = useTenantId();
  const mutation = useCreateEmployee(tid);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employmentType: 'full_time' },
  });

  const onValid = (values: EmployeeForm) =>
    mutation.mutate({ ...values, tenantId: tid }, { onSuccess: () => navigate({ to: '/employees' }) });

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
            <Field label="Department" htmlFor="department" error={errors.department?.message}>
              <Input id="department" aria-invalid={!!errors.department} {...register('department')} />
            </Field>
            <Field label="Position" htmlFor="position" error={errors.position?.message}>
              <Input id="position" aria-invalid={!!errors.position} {...register('position')} />
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
  const tid = useTenantId();
  const query = useEmployee(tid, employeeId as string);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [terminated, setTerminated] = useState(false);

  if (query.isPending) return <PageLoadingState />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} retrying={query.isFetching} />;
  const employee = query.data;
  if (!employee) return <EmptyState title="Employee not found" />;

  return (
    <>
      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeNumber} · ${employee.workEmail}`}
        actions={
          <Badge tone={terminated ? 'offline' : 'healthy'}>
            {terminated ? 'terminated' : employee.status.replace(/_/g, ' ')}
          </Badge>
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
          {terminated ? (
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
        description={`This will set ${employee.fullName} to terminated. You can reactivate later.`}
        confirmLabel="Terminate"
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setTerminated(true);
          setConfirmOpen(false);
          notify.recordUpdated('Employee');
        }}
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
  const tid = useTenantId();
  const query = usePositions(tid);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Positions" actions={<Button>Add Position</Button>} />
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
                  <Badge tone={p.status === 'active' ? 'healthy' : 'neutral'}>{p.status}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </TableBoundary>
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
  const { company } = useSession();
  const tid = useTenantId();
  // Backend-equivalent gate: Beta (no Leave package) must never reach content.
  if (!canAccessLeave(company)) return <PackageUnavailableState packageName="Leave Management" />;

  return <LeaveContent tenantId={tid} />;
}

function LeaveContent({ tenantId }: { tenantId: string }) {
  const query = useLeaveRequests(tenantId);
  const filtered = query.data ?? [];
  const decide = (verdict: 'approved' | 'rejected') => notify.requestStatusChanged(verdict);
  return (
    <>
      <PageHeader title="Leave Management" actions={<Button>Add Request</Button>} />
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
                  <Badge tone={l.status === 'approved' ? 'healthy' : l.status === 'rejected' ? 'offline' : 'degraded'}>
                    {l.status}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => decide('approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide('rejected')}>
                      Reject
                    </Button>
                  </div>
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
  const { company } = useSession();
  const tid = useTenantId();
  if (!canAccessAttendance(company)) return <PackageUnavailableState packageName="Attendance Management" />;
  return <AttendanceContent tenantId={tid} />;
}

function AttendanceContent({ tenantId }: { tenantId: string }) {
  const query = useAttendance(tenantId);
  const filtered = query.data ?? [];
  return (
    <>
      <PageHeader title="Attendance Management" actions={<Button>Add Attendance</Button>} />
      <TableBoundary query={query} filtered={filtered} cols={6} emptyTitle="No attendance records">
        <DataTable>
          <THead>
            <TH>Employee</TH>
            <TH>Date</TH>
            <TH>Check-in</TH>
            <TH>Check-out</TH>
            <TH>Total Hours</TH>
            <TH>Status</TH>
          </THead>
          <TBody>
            {filtered.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.employee}</TD>
                <TD>{a.date}</TD>
                <TD>{a.checkIn}</TD>
                <TD>{a.checkOut}</TD>
                <TD>{a.totalHours}</TD>
                <TD>
                  <Badge tone={a.status === 'present' ? 'healthy' : a.status === 'late' ? 'degraded' : 'offline'}>
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
