import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import { AdminShell } from '@/components/admin-shell';
import { WorkspaceShell } from '@/components/workspace-shell';
import {
  AccessDeniedPage,
  CompanySuspendedPage,
  LoginPage,
  RegisterPage,
} from '@/pages/public';
import {
  AdminDashboard,
  AuditPage,
  CompaniesList,
  CompanyDetails,
  CreatePackage,
  CreateRequest,
  DiagnosticReportPage,
  HealthPage,
  InstallationsPage,
  PackageDetails,
  PackagesList,
  RequestDetails,
  RequestsList,
  UsagePage,
} from '@/pages/admin';
import {
  AddEmployee,
  AttendancePage,
  DepartmentsPage,
  EmployeeProfile,
  EmployeesList,
  InstalledPackagesPage,
  LeavePage,
  PositionsPage,
  SettingsPage,
  UpdatesPage,
  UsersPage,
  WorkspaceDashboard,
} from '@/pages/workspace';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

// --- Public -------------------------------------------------------------------

/** Typed search for the single reusable login route. */
export interface LoginSearch {
  portal?: 'admin';
  tenant?: string;
}

// The bare root always sends unauthenticated visitors to the Platform Super
// Admin login. A router-level redirect (not duplicated markup) keeps a single
// reusable <LoginPage>; there is no loop because /login does not redirect back.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/login', search: { portal: 'admin' } });
  },
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    portal: search.portal === 'admin' ? 'admin' : undefined,
    tenant: typeof search.tenant === 'string' ? search.tenant : undefined,
  }),
  component: LoginPage,
});
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: RegisterPage });
const accessDeniedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access-denied',
  component: AccessDeniedPage,
});
const companySuspendedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-suspended',
  component: CompanySuspendedPage,
});

// --- Platform Super Admin -----------------------------------------------------
const adminLayout = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
const adminIndex = createRoute({ getParentRoute: () => adminLayout, path: '/', component: AdminDashboard });
const adminCompanies = createRoute({ getParentRoute: () => adminLayout, path: 'companies', component: CompaniesList });
const adminCompanyDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'companies/$companyId',
  component: CompanyDetails,
});
const adminRequests = createRoute({ getParentRoute: () => adminLayout, path: 'requests', component: RequestsList });
const adminRequestNew = createRoute({ getParentRoute: () => adminLayout, path: 'requests/new', component: CreateRequest });
const adminRequestDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'requests/$requestId',
  component: RequestDetails,
});
const adminPackages = createRoute({ getParentRoute: () => adminLayout, path: 'packages', component: PackagesList });
const adminPackageNew = createRoute({ getParentRoute: () => adminLayout, path: 'packages/new', component: CreatePackage });
const adminPackageDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'packages/$packageId',
  component: PackageDetails,
});
const adminDiagnostic = createRoute({
  getParentRoute: () => adminLayout,
  path: 'diagnostics/$diagnosticId',
  component: DiagnosticReportPage,
});
const adminInstallations = createRoute({
  getParentRoute: () => adminLayout,
  path: 'installations',
  component: InstallationsPage,
});
const adminUsage = createRoute({ getParentRoute: () => adminLayout, path: 'usage', component: UsagePage });
const adminHealth = createRoute({ getParentRoute: () => adminLayout, path: 'health', component: HealthPage });
const adminAudit = createRoute({ getParentRoute: () => adminLayout, path: 'audit', component: AuditPage });

// --- Company Workspace (pathless layout) --------------------------------------
const workspaceLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'workspace',
  component: () => (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  ),
});
const wsDashboard = createRoute({ getParentRoute: () => workspaceLayout, path: '/dashboard', component: WorkspaceDashboard });
const wsEmployees = createRoute({ getParentRoute: () => workspaceLayout, path: '/employees', component: EmployeesList });
const wsEmployeeNew = createRoute({ getParentRoute: () => workspaceLayout, path: '/employees/new', component: AddEmployee });
const wsEmployeeDetail = createRoute({
  getParentRoute: () => workspaceLayout,
  path: '/employees/$employeeId',
  component: EmployeeProfile,
});
const wsDepartments = createRoute({ getParentRoute: () => workspaceLayout, path: '/departments', component: DepartmentsPage });
const wsPositions = createRoute({ getParentRoute: () => workspaceLayout, path: '/positions', component: PositionsPage });
const wsUpdates = createRoute({ getParentRoute: () => workspaceLayout, path: '/updates', component: UpdatesPage });
const wsPackages = createRoute({ getParentRoute: () => workspaceLayout, path: '/packages', component: InstalledPackagesPage });
const wsUsers = createRoute({ getParentRoute: () => workspaceLayout, path: '/users', component: UsersPage });
const wsSettings = createRoute({ getParentRoute: () => workspaceLayout, path: '/settings', component: SettingsPage });
const wsLeave = createRoute({ getParentRoute: () => workspaceLayout, path: '/leave', component: LeavePage });
const wsAttendance = createRoute({ getParentRoute: () => workspaceLayout, path: '/attendance', component: AttendancePage });

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  accessDeniedRoute,
  companySuspendedRoute,
  adminLayout.addChildren([
    adminIndex,
    adminCompanies,
    adminCompanyDetail,
    adminRequests,
    adminRequestNew,
    adminRequestDetail,
    adminPackages,
    adminPackageNew,
    adminPackageDetail,
    adminDiagnostic,
    adminInstallations,
    adminUsage,
    adminHealth,
    adminAudit,
  ]),
  workspaceLayout.addChildren([
    wsDashboard,
    wsEmployees,
    wsEmployeeNew,
    wsEmployeeDetail,
    wsDepartments,
    wsPositions,
    wsUpdates,
    wsPackages,
    wsUsers,
    wsSettings,
    wsLeave,
    wsAttendance,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
