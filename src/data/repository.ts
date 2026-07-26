// ---------------------------------------------------------------------------
// Repository factory — the single place that selects the concrete data source.
// The Supabase aggregate adapter is loaded lazily so the mock/default bundle
// does not pay the Supabase SDK cost.
// ---------------------------------------------------------------------------

import { api } from './api';
import type { Repository } from './repository.types';
import type { PackageKey, RequestStatus } from './types';

export type DataSource = 'mock' | 'supabase';

/**
 * Which data source to use. Defaults to 'mock'. Set VITE_DATA_SOURCE=supabase
 * for a hosted/local Supabase environment.
 */
export function resolveDataSource(): DataSource {
  const configured = import.meta.env.VITE_DATA_SOURCE;
  return configured === 'supabase' ? 'supabase' : 'mock';
}

export function createRepository(source: DataSource = resolveDataSource()): Repository {
  switch (source) {
    case 'supabase':
      return new LazySupabaseRepository();
    case 'mock':
    default:
      return api;
  }
}

/**
 * Defers the aggregate adapter and its Supabase SDK dependency until the first
 * repository method is used. Focused feature repositories use the same pattern
 * in their own modules.
 */
class LazySupabaseRepository implements Repository {
  private realP: Promise<Repository> | null = null;

  private real = (): Promise<Repository> => {
    this.realP ??= import('./supabase-repository').then((m) => new m.SupabaseRepository());
    return this.realP;
  };

  getCompanies = () => this.real().then((repository) => repository.getCompanies());
  getCompany = (id: string) => this.real().then((repository) => repository.getCompany(id));
  getRequests = () => this.real().then((repository) => repository.getRequests());
  getRequest = (id: string) => this.real().then((repository) => repository.getRequest(id));
  getPackages = () => this.real().then((repository) => repository.getPackages());
  getPackage = (key: string) => this.real().then((repository) => repository.getPackage(key));
  getDiagnostic = (id: string) => this.real().then((repository) => repository.getDiagnostic(id));
  getDiagnostics = () => this.real().then((repository) => repository.getDiagnostics());
  getInstallations = () => this.real().then((repository) => repository.getInstallations());
  getUsage = () => this.real().then((repository) => repository.getUsage());
  getHealth = () => this.real().then((repository) => repository.getHealth());
  getAudit = () => this.real().then((repository) => repository.getAudit());
  getEmployees = (tenantId: string) => this.real().then((repository) => repository.getEmployees(tenantId));
  getEmployee = (id: string) => this.real().then((repository) => repository.getEmployee(id));
  getDepartments = (tenantId: string) => this.real().then((repository) => repository.getDepartments(tenantId));
  getPositions = (tenantId: string) => this.real().then((repository) => repository.getPositions(tenantId));
  getCompanyUsers = (tenantId: string) => this.real().then((repository) => repository.getCompanyUsers(tenantId));
  getInstallationsForTenant = (tenantId: string) =>
    this.real().then((repository) => repository.getInstallationsForTenant(tenantId));
  getLeaveRequests = (tenantId: string) => this.real().then((repository) => repository.getLeaveRequests(tenantId));
  getAttendance = (tenantId: string) => this.real().then((repository) => repository.getAttendance(tenantId));
  createEmployee = (input: Parameters<Repository['createEmployee']>[0]) =>
    this.real().then((repository) => repository.createEmployee(input));
  disableDepartment = (id: string) => this.real().then((repository) => repository.disableDepartment(id));
  createRequest = (input: Parameters<Repository['createRequest']>[0]) =>
    this.real().then((repository) => repository.createRequest(input));
  changeRequestStatus = (id: string, status: RequestStatus) =>
    this.real().then((repository) => repository.changeRequestStatus(id, status));
  createPackage = (input: Parameters<Repository['createPackage']>[0]) =>
    this.real().then((repository) => repository.createPackage(input));
  assignPackage = (packageKey: PackageKey, companyId: string) =>
    this.real().then((repository) => repository.assignPackage(packageKey, companyId));
  saveSettings = (input: Record<string, unknown>) =>
    this.real().then((repository) => repository.saveSettings(input));
  installPackage = (packageKey: PackageKey, companyId: string) =>
    this.real().then((repository) => repository.installPackage(packageKey, companyId));
}

/** Default repository instance consumed by hooks. */
export const repository: Repository = createRepository();

export type { Repository } from './repository.types';
