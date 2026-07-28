import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import { AdminShell } from '@/components/admin-shell';
import { WorkspaceShell } from '@/components/workspace-shell';
import { PlatformGuard, CompanyGuard } from '@/components/guards';
import { PageLoadingState, ErrorState } from '@/components/states';
// Public/auth pages are eager so sign-in is instant. The admin and company
// workspace page groups are code-split (lazy) so they load only when entered.
import {
  AccessDeniedPage,
  CompanySuspendedPage,
  LoginPage,
  RegisterPage,
} from '@/pages/public';

// Lazy loaders — each unique import specifier becomes its own Vite chunk, so
// every admin route shares one "admin" chunk and every workspace route shares
// one "workspace" chunk, both separate from the initial auth bundle.
const adminPage = (name: keyof typeof import('@/pages/admin')) =>
  lazyRouteComponent(() => import('@/pages/admin'), name);
const workspacePage = (name: keyof typeof import('@/pages/workspace')) =>
  lazyRouteComponent(() => import('@/pages/workspace'), name);

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

// --- Platform Super Admin (lazy page group) ----------------------------------
const adminLayout = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <PlatformGuard>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </PlatformGuard>
  ),
});
const adminIndex = createRoute({ getParentRoute: () => adminLayout, path: '/', component: adminPage('AdminDashboard') });
const adminCompanies = createRoute({ getParentRoute: () => adminLayout, path: 'companies', component: adminPage('CompaniesList') });
const adminCompanyDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'companies/$companyId',
  component: adminPage('CompanyDetails'),
});
const adminRequests = createRoute({ getParentRoute: () => adminLayout, path: 'requests', component: adminPage('RequestsList') });
const adminRequestNew = createRoute({ getParentRoute: () => adminLayout, path: 'requests/new', component: adminPage('CreateRequest') });
const adminRequestDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'requests/$requestId',
  component: adminPage('RequestDetails'),
});
const adminPackages = createRoute({ getParentRoute: () => adminLayout, path: 'packages', component: adminPage('PackagesList') });
const adminPackageNew = createRoute({ getParentRoute: () => adminLayout, path: 'packages/new', component: adminPage('CreatePackage') });
const adminPackageReleaseNew = createRoute({ getParentRoute: () => adminLayout, path: 'packages/releases/new', component: adminPage('CreatePackageRelease') });
const adminPackageVersionNew = createRoute({ getParentRoute: () => adminLayout, path: 'packages/$packageKey/versions/new', component: adminPage('CreatePackageVersion') });
const adminPackageDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'packages/$packageId',
  component: adminPage('PackageDetails'),
});
const adminReleaseDetail = createRoute({
  getParentRoute: () => adminLayout,
  path: 'releases/$releaseId',
  component: adminPage('ReleaseDetails'),
});
const adminDiagnostic = createRoute({
  getParentRoute: () => adminLayout,
  path: 'diagnostics/$diagnosticId',
  component: adminPage('DiagnosticReportPage'),
});
const adminDiagnostics = createRoute({
  getParentRoute: () => adminLayout,
  path: 'diagnostics',
  component: adminPage('DiagnosticsList'),
});
const adminInstallations = createRoute({
  getParentRoute: () => adminLayout,
  path: 'installations',
  component: adminPage('InstallationsPage'),
});
const adminLifecycle = createRoute({
  getParentRoute: () => adminLayout,
  path: 'lifecycle',
  component: adminPage('LifecycleMonitoringPage'),
});
const adminAdoption = createRoute({
  getParentRoute: () => adminLayout,
  path: 'packages/adoption',
  component: adminPage('AdoptionPage'),
});
const adminUsage = createRoute({ getParentRoute: () => adminLayout, path: 'usage', component: adminPage('UsagePage') });
const adminHealth = createRoute({ getParentRoute: () => adminLayout, path: 'health', component: adminPage('HealthPage') });
const adminAudit = createRoute({ getParentRoute: () => adminLayout, path: 'audit', component: adminPage('AuditPage') });

// --- Company Workspace (path-based tenant prefix, lazy page group) ------------
// Every company route is nested under `/$companySlug`, e.g. `/rich/dashboard`.
// The slug is a ROUTING identifier only: CompanyGuard verifies it against the
// authenticated membership, and the security boundary stays company_id + RLS.
// Static routes (/admin, /login, …) take priority over this dynamic segment.
const workspaceLayout = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$companySlug',
  component: () => (
    <CompanyGuard>
      <WorkspaceShell>
        <Outlet />
      </WorkspaceShell>
    </CompanyGuard>
  ),
});
// Bare `/$companySlug` sends the founder to their dashboard.
const wsIndex = createRoute({
  getParentRoute: () => workspaceLayout,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$companySlug/dashboard', params: { companySlug: params.companySlug } });
  },
});
const wsDashboard = createRoute({ getParentRoute: () => workspaceLayout, path: 'dashboard', component: workspacePage('WorkspaceDashboard') });
const wsEmployees = createRoute({ getParentRoute: () => workspaceLayout, path: 'employees', component: workspacePage('EmployeesList') });
const wsEmployeeNew = createRoute({ getParentRoute: () => workspaceLayout, path: 'employees/new', component: workspacePage('AddEmployee') });
const wsEmployeeDetail = createRoute({
  getParentRoute: () => workspaceLayout,
  path: 'employees/$employeeId',
  component: workspacePage('EmployeeProfile'),
});
const wsDepartments = createRoute({ getParentRoute: () => workspaceLayout, path: 'departments', component: workspacePage('DepartmentsPage') });
const wsPositions = createRoute({ getParentRoute: () => workspaceLayout, path: 'positions', component: workspacePage('PositionsPage') });
const wsUpdates = createRoute({ getParentRoute: () => workspaceLayout, path: 'updates', component: workspacePage('UpdatesPage') });
const wsPackages = createRoute({ getParentRoute: () => workspaceLayout, path: 'packages', component: workspacePage('InstalledPackagesPage') });
const wsUsers = createRoute({ getParentRoute: () => workspaceLayout, path: 'users', component: workspacePage('UsersPage') });
const wsSettings = createRoute({ getParentRoute: () => workspaceLayout, path: 'settings', component: workspacePage('SettingsPage') });
const wsLeave = createRoute({ getParentRoute: () => workspaceLayout, path: 'leave', component: workspacePage('LeavePage') });
const wsAttendance = createRoute({ getParentRoute: () => workspaceLayout, path: 'attendance', component: workspacePage('AttendancePage') });
const wsMarketplace = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/marketplace', component: workspacePage('MarketplacePage') });
const wsAnnouncements = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/announcements', component: workspacePage('AnnouncementsPage') });
const wsAssets = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/assets', component: workspacePage('AssetRegisterPage') });
const wsPulseSurveys = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/pulse-surveys', component: workspacePage('PulseSurveysPage') });
const wsOrgChart = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/org-chart', component: workspacePage('OrgChartPage') });
const wsDocumentNotes = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/document-notes', component: workspacePage('DocumentNotesPage') });
const wsExpenseRequests = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/expense-requests', component: workspacePage('ExpenseRequestsPage') });
const wsVisitorRegister = createRoute({ getParentRoute: () => workspaceLayout, path: 'extensions/visitor-register', component: workspacePage('VisitorRegisterPage') });

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
    adminPackageReleaseNew,
    adminPackageVersionNew,
    adminPackageDetail,
    adminReleaseDetail,
    adminDiagnostic,
    adminDiagnostics,
    adminInstallations,
    adminLifecycle,
    adminAdoption,
    adminUsage,
    adminHealth,
    adminAudit,
  ]),
  workspaceLayout.addChildren([
    wsIndex,
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
    wsMarketplace,
    wsAnnouncements,
    wsAssets,
    wsPulseSurveys,
    wsOrgChart,
    wsDocumentNotes,
    wsExpenseRequests,
    wsVisitorRegister,
  ]),
]);

export const router = createRouter({
  routeTree,
  // Shared route-level fallbacks — reuse the existing state components rather
  // than duplicating loading/error UI per lazy route.
  defaultPendingComponent: () => <PageLoadingState />,
  defaultErrorComponent: ({ reset }) => <ErrorState onRetry={reset} />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
