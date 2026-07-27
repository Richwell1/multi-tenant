import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import type { PackageCategory } from '@/lib/packages/category';
import type {
  CompanyPackageLifecycle,
  LifecycleOperationRecord,
  LifecycleOperationState,
  LifecycleOperationType,
  LifecycleResult,
  PackageDataState,
  PackageLifecycleRepository,
} from './types';

interface CompanyPackageRow {
  package_key: string;
  package_version: string | null;
  enabled: boolean;
  data_state: PackageDataState;
  retention_until: string | null;
  installation_source: string | null;
  packages: { name: string; category: PackageCategory; is_mandatory: boolean; feature_table: string | null } | null;
}

/**
 * Supabase lifecycle adapter. Reads company_packages joined with the catalog
 * (RLS restricts to the caller's company) and drives the SECURITY DEFINER RPCs.
 * The browser never gets the service role; each RPC self-authorizes.
 */
export class SupabasePackageLifecycleRepository implements PackageLifecycleRepository {
  async listCompanyPackages(companyId: string): Promise<CompanyPackageLifecycle[]> {
    const { data, error } = await getSupabaseClient()
      .from('company_packages')
      .select('package_key, package_version, enabled, data_state, retention_until, installation_source, packages(name, category, is_mandatory, feature_table)')
      .eq('company_id', companyId);
    if (error) throw mapSupabaseError(error, 'package-lifecycle.list');
    return ((data ?? []) as unknown as CompanyPackageRow[]).map((r) => ({
      packageKey: r.package_key,
      name: r.packages?.name ?? r.package_key,
      category: r.packages?.category ?? 'standard_package',
      installedVersion: r.package_version,
      enabled: r.enabled,
      dataState: r.data_state,
      retentionUntil: r.retention_until,
      isMandatory: r.packages?.is_mandatory ?? false,
      installationSource: r.installation_source,
      hasFeatureData: !!r.packages?.feature_table,
    }));
  }

  private async rpc(fn: string, args: Record<string, unknown>, op: string): Promise<LifecycleResult> {
    const { data, error } = await getSupabaseClient().rpc(fn, args);
    if (error) throw mapSupabaseError(error, op);
    const result = (data ?? {}) as { package_key?: string; status?: string };
    return { packageKey: result.package_key ?? '', status: result.status ?? 'ok' };
  }

  disable(_companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.rpc('disable_package', { p_package_key: packageKey }, 'package-lifecycle.disable');
  }
  enable(_companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.rpc('enable_package', { p_package_key: packageKey }, 'package-lifecycle.enable');
  }
  uninstall(_companyId: string, packageKey: string, reason?: string): Promise<LifecycleResult> {
    return this.rpc('uninstall_package', { p_package_key: packageKey, p_reason: reason ?? null }, 'package-lifecycle.uninstall');
  }
  restore(_companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.rpc('restore_package', { p_package_key: packageKey }, 'package-lifecycle.restore');
  }
  permanentlyRemove(_companyId: string, packageKey: string): Promise<LifecycleResult> {
    return this.rpc('permanently_remove_package', { p_package_key: packageKey }, 'package-lifecycle.permanently_remove');
  }

  async listOperations(): Promise<LifecycleOperationRecord[]> {
    // RLS: platform admins see all rows; company members see only their own.
    const { data, error } = await getSupabaseClient()
      .from('package_lifecycle_operations')
      .select('id, package_key, operation, status, source_version, target_version, diagnostics_status, correlation_id, failure_reason, started_at, completed_at, companies(name), packages(name)')
      .order('started_at', { ascending: false })
      .limit(200);
    if (error) throw mapSupabaseError(error, 'package-lifecycle.operations');
    interface Row {
      id: string; package_key: string; operation: LifecycleOperationType; status: LifecycleOperationState;
      source_version: string | null; target_version: string | null; diagnostics_status: string | null;
      correlation_id: string; failure_reason: string | null; started_at: string; completed_at: string | null;
      companies: { name: string } | null; packages: { name: string } | null;
    }
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      companyName: r.companies?.name ?? '—',
      packageKey: r.package_key,
      packageName: r.packages?.name ?? r.package_key,
      operation: r.operation,
      status: r.status,
      sourceVersion: r.source_version,
      targetVersion: r.target_version,
      diagnosticsStatus: r.diagnostics_status,
      correlationId: r.correlation_id,
      failureReason: r.failure_reason,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  }
}
