import { getSupabaseClient } from '@/lib/supabase';
import { logSupabaseError, mapSupabaseError } from '@/data/errors';
import type { PackageType } from '@/data/types';
import type {
  InstallationRepository,
  PackageAssignmentRepository,
  PackageReleaseRepository,
  PackageRepository,
} from './package-repository';
import type {
  CompanyPackageAssignment,
  InstallationFilters,
  InstallationRecoveryResult,
  Package,
  PackageDiagnosticStatus,
  PackageInstallation,
  PackageInstallationStatus,
  PackageVersion,
  PublishReleaseInput,
  PublishReleaseResult,
} from './types';

export class SupabasePackageRepository implements PackageRepository {
  async list(): Promise<Package[]> {
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .select('key,name,description,type,is_active')
      .order('name');
    if (error) throw mapSupabaseError(error, 'admin.packages.catalog');
    return ((data ?? []) as unknown as Array<{ key: string; name: string; description: string | null; type: PackageType; is_active: boolean }>).map(
      (r) => ({ code: r.key, name: r.name, description: r.description ?? '', classification: r.type, isActive: r.is_active }),
    );
  }
  async getByCode(code: string): Promise<Package | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .select('key,name,description,type,is_active')
      .eq('key', code)
      .maybeSingle();
    if (error) throw mapSupabaseError(error, 'admin.packages.detail');
    if (!data) return undefined;
    const r = data as unknown as { key: string; name: string; description: string | null; type: PackageType; is_active: boolean };
    return { code: r.key, name: r.name, description: r.description ?? '', classification: r.type, isActive: r.is_active };
  }
  async listVersions(packageCode: string): Promise<PackageVersion[]> {
    const { data, error } = await getSupabaseClient()
      .from('package_versions')
      .select('id,package_key,version,notes,diagnostic_status,released_at')
      .eq('package_key', packageCode)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'admin.packages.versions');
    return ((data ?? []) as unknown as Array<{ id: string; package_key: string; version: string; notes: string; diagnostic_status: PackageDiagnosticStatus | null; released_at: string | null }>).map(
      (r) => ({ id: r.id, packageCode: r.package_key, version: r.version, releaseNotes: r.notes, diagnosticStatus: r.diagnostic_status, releasedAt: r.released_at }),
    );
  }
}

export class SupabasePackageReleaseRepository implements PackageReleaseRepository {
  async publish(input: PublishReleaseInput): Promise<PublishReleaseResult> {
    // Platform-Admin-only publish via the trusted RPC (self-authorizes server-side).
    const { data, error } = await getSupabaseClient().rpc('publish_package_release', {
      p_version_id: input.packageVersionId,
      p_target_mode: input.mode,
      p_company_ids: input.companyIds,
      p_automatic_install: input.automaticInstall,
    });
    if (error) throw mapSupabaseError(error, 'admin.packages.publish');
    const r = data as unknown as {
      release_id: string;
      package_key: string;
      version: string;
      target_mode: PublishReleaseResult['mode'];
      target_count: number;
      automatic_install: boolean;
    };
    return {
      releaseId: r.release_id,
      packageCode: r.package_key,
      version: r.version,
      mode: r.target_mode,
      targetCount: r.target_count,
      automaticInstall: r.automatic_install,
    };
  }
}

export class SupabasePackageAssignmentRepository implements PackageAssignmentRepository {
  async listForCompany(companyId: string): Promise<CompanyPackageAssignment[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('company_packages')
      .select('company_id,package_key,package_version,enabled,status,assigned_at')
      .eq('company_id', companyId);
    if (error) throw mapSupabaseError(error, 'admin.company_packages.list');
    const rows = (data ?? []) as unknown as Array<{
      company_id: string;
      package_key: string;
      package_version: string | null;
      enabled: boolean;
      status: string;
      assigned_at: string | null;
    }>;
    const packageNames = new Map<string, string>();
    if (rows.length) {
      const packageResult = await client.from('packages').select('key,name').in(
        'key',
        [...new Set(rows.map((row) => row.package_key))],
      );
      if (packageResult.error) {
        logSupabaseError('admin.company_packages.catalog', packageResult.error);
      } else {
        for (const row of (packageResult.data ?? []) as unknown as Array<{ key: string; name: string }>) {
          packageNames.set(row.key, row.name);
        }
      }
    }
    return rows.map(
      (r) => ({
        companyId: r.company_id,
        packageCode: r.package_key,
        packageName: packageNames.get(r.package_key) ?? r.package_key,
        version: r.package_version,
        enabled: r.enabled,
        status: r.status,
        assignedAt: r.assigned_at,
      }),
    );
  }
}

export class SupabaseInstallationRepository implements InstallationRepository {
  async list(filters: InstallationFilters = {}): Promise<PackageInstallation[]> {
    const client = getSupabaseClient();
    let query = client
      .from('package_installations')
      .select('id,release_id,company_id,package_key,version,status,started_at,completed_at,error')
      .order('started_at', { ascending: false });
    if (filters.companyIds?.length) query = query.in('company_id', filters.companyIds);
    if (filters.packageCode) query = query.eq('package_key', filters.packageCode);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw mapSupabaseError(error, 'admin.installations.list');
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      release_id: string;
      company_id: string;
      package_key: string;
      version: string;
      status: PackageInstallationStatus;
      started_at: string;
      completed_at: string | null;
      error: string | null;
    }>;
    const companyNames = new Map<string, string>();
    if (rows.length) {
      const companyResult = await client.from('companies').select('id,name').in(
        'id',
        [...new Set(rows.map((row) => row.company_id))],
      );
      if (companyResult.error) {
        logSupabaseError('admin.installations.companies', companyResult.error);
      } else {
        for (const row of (companyResult.data ?? []) as unknown as Array<{ id: string; name: string }>) {
          companyNames.set(row.id, row.name);
        }
      }
    }
    return rows.map(
      (r) => ({
        id: r.id,
        releaseId: r.release_id,
        companyId: r.company_id,
        companyName: companyNames.get(r.company_id) ?? r.company_id,
        packageCode: r.package_key,
        version: r.version,
        status: r.status,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        error: r.error,
      }),
    );
  }

  async retry(id: string): Promise<InstallationRecoveryResult> {
    const { data, error } = await getSupabaseClient().rpc('retry_package_installation', {
      p_installation_id: id,
    });
    if (error) throw mapSupabaseError(error, 'admin.installations.retry');
    return data as unknown as InstallationRecoveryResult;
  }

  async rollback(id: string): Promise<InstallationRecoveryResult> {
    const { data, error } = await getSupabaseClient().rpc('rollback_package_installation', {
      p_installation_id: id,
    });
    if (error) throw mapSupabaseError(error, 'admin.installations.rollback');
    return data as unknown as InstallationRecoveryResult;
  }
}
