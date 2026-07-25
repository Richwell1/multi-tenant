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

  private real(): Promise<Repository> {
    this.realP ??= import('./supabase-repository').then((m) => new m.SupabaseRepository());
    return this.realP;
  }

  getCompanies() { return this.real().then((r) => r.getCompanies()); }
  getCompany(id: string) { return this.real().then((r) => r.getCompany(id)); }
  getRequests() { return this.real().then((r) => r.getRequests()); }
  getRequest(id: string) { return this.real().then((r) => r.getRequest(id)); }
  getPackages() { return this.real().then((r) => r.getPackages()); }
  getPackage(key: string) { return this.real().then((r) => r.getPackage(key)); }
  getDiagnostic(id: string) { return this.real().then((r) => r.getDiagnostic(id)); }
  getDiagnostics() { return this.real().then((r) => r.getDiagnostics()); }
  getInstallations() { return this.real().then((r) => r.getInstallations()); }
  getUsage() { return this.real().then((r) => r.getUsage()); }
  getHealth() { return this.real().then((r) => r.getHealth()); }
  getAudit() { return this.real().then((r) => r.getAudit()); }
  getEmployees(tenantId: string) { return this.real().then((r) => r.getEmployees(tenantId)); }
  getEmployee(id: string) { return this.real().then((r) => r.getEmployee(id)); }
  getDepartments(tenantId: string) { return this.real().then((r) => r.getDepartments(tenantId)); }
  getPositions(tenantId: string) { return this.real().then((r) => r.getPositions(tenantId)); }
  getCompanyUsers(tenantId: string) { return this.real().then((r) => r.getCompanyUsers(tenantId)); }
  getInstallationsForTenant(tenantId: string) { return this.real().then((r) => r.getInstallationsForTenant(tenantId)); }
  getLeaveRequests(tenantId: string) { return this.real().then((r) => r.getLeaveRequests(tenantId)); }
  getAttendance(tenantId: string) { return this.real().then((r) => r.getAttendance(tenantId)); }
  createEmployee(input: Parameters<Repository['createEmployee']>[0]) { return this.real().then((r) => r.createEmployee(input)); }
  disableDepartment(id: string) { return this.real().then((r) => r.disableDepartment(id)); }
  createRequest(input: Parameters<Repository['createRequest']>[0]) { return this.real().then((r) => r.createRequest(input)); }
  changeRequestStatus(id: string, status: RequestStatus) { return this.real().then((r) => r.changeRequestStatus(id, status)); }
  createPackage(input: Parameters<Repository['createPackage']>[0]) { return this.real().then((r) => r.createPackage(input)); }
  assignPackage(packageKey: PackageKey, companyId: string) { return this.real().then((r) => r.assignPackage(packageKey, companyId)); }
  saveSettings(input: Record<string, unknown>) { return this.real().then((r) => r.saveSettings(input)); }
  installPackage(packageKey: PackageKey, companyId: string) { return this.real().then((r) => r.installPackage(packageKey, companyId)); }
}

/** Default repository instance consumed by hooks. */
export const repository: Repository = createRepository();

export type { Repository } from './repository.types';
