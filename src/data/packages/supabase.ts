import { getSupabaseClient } from '@/lib/supabase';
import { logSupabaseError, mapSupabaseError } from '@/data/errors';
import { toPackageCategory } from '@/lib/packages/category';
import type { PackageType } from '@/data/types';

interface PackageRow {
  key: string;
  name: string;
  description: string | null;
  type: PackageType;
  category: string | null;
  base_package_key: string | null;
  is_active: boolean;
}

const toPackage = (r: PackageRow): Package => ({
  code: r.key,
  name: r.name,
  description: r.description ?? '',
  classification: r.type,
  category: toPackageCategory({ category: r.category, type: r.type }),
  basePackageKey: r.base_package_key ?? null,
  isActive: r.is_active,
});
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
  CreatePackageInput,
  CreateVersionInput,
  CreatedPackage,
  PackageReleaseDetails,
  ReleaseInstallationResult,
  ReleasePlanResult,
  PublishReleaseInput,
  PublishReleaseResult,
} from './types';

export class SupabasePackageRepository implements PackageRepository {
  async list(): Promise<Package[]> {
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .select('key,name,description,type,category,base_package_key,is_active')
      .order('name');
    if (error) throw mapSupabaseError(error, 'admin.packages.catalog');
    return ((data ?? []) as unknown as PackageRow[]).map(toPackage);
  }
  async getByCode(code: string): Promise<Package | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .select('key,name,description,type,category,base_package_key,is_active')
      .eq('key', code)
      .maybeSingle();
    if (error) throw mapSupabaseError(error, 'admin.packages.detail');
    if (!data) return undefined;
    return toPackage(data as unknown as PackageRow);
  }
  async listVersions(packageCode: string): Promise<PackageVersion[]> {
    const { data, error } = await getSupabaseClient()
      .from('package_versions')
      .select('id,package_key,version,notes,compatibility_notes,diagnostic_status,released_at')
      .eq('package_key', packageCode)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'admin.packages.versions');
    return ((data ?? []) as unknown as Array<{ id: string; package_key: string; version: string; notes: string; compatibility_notes: string; diagnostic_status: PackageDiagnosticStatus | null; released_at: string | null }>).map(
      (r) => ({ id: r.id, packageCode: r.package_key, version: r.version, releaseNotes: r.notes, compatibilityNotes: r.compatibility_notes ?? '', diagnosticStatus: r.diagnostic_status, releasedAt: r.released_at }),
    );
  }

  async createPackage(input: CreatePackageInput): Promise<CreatedPackage> {
    const { data, error } = await getSupabaseClient().rpc('create_package_with_version', {
      p_key: input.code,
      p_name: input.name,
      p_type: input.classification,
      p_description: input.description,
      p_version: input.version,
      p_release_notes: input.releaseNotes,
      p_base_package_key: input.baseCode ?? undefined,
    });
    if (error) throw mapSupabaseError(error, 'admin.packages.create');
    const result = data as unknown as {
      package: { key: string; name: string; type: PackageType; description: string; is_active: boolean; category?: string | null; base_package_key?: string | null };
      version: { id: string; package_key: string; version: string; notes: string; compatibility_notes: string; diagnostic_status: PackageDiagnosticStatus | null; released_at: string | null };
    };
    return {
      package: {
        code: result.package.key,
        name: result.package.name,
        classification: result.package.type,
        category: toPackageCategory({ category: result.package.category, type: result.package.type }),
        basePackageKey: result.package.base_package_key ?? null,
        description: result.package.description,
        isActive: result.package.is_active,
      },
      version: {
        id: result.version.id,
        packageCode: result.version.package_key,
        version: result.version.version,
        releaseNotes: result.version.notes,
        compatibilityNotes: result.version.compatibility_notes ?? '',
        diagnosticStatus: result.version.diagnostic_status,
        releasedAt: result.version.released_at,
      },
    };
  }

  async createVersion(input: CreateVersionInput): Promise<PackageVersion> {
    const { data, error } = await getSupabaseClient().rpc('create_package_version', {
      p_package_key: input.packageCode,
      p_version: input.version,
      p_release_notes: input.releaseNotes,
      p_compatibility_notes: input.compatibilityNotes,
    });
    if (error) throw mapSupabaseError(error, 'admin.packages.version.create');
    const result = data as unknown as { id: string; package_key: string; version: string; notes: string; compatibility_notes: string; diagnostic_status: PackageDiagnosticStatus | null; released_at: string | null };
    return {
      id: result.id,
      packageCode: result.package_key,
      version: result.version,
      releaseNotes: result.notes,
      compatibilityNotes: result.compatibility_notes ?? '',
      diagnosticStatus: result.diagnostic_status,
      releasedAt: result.released_at,
    };
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

  async createPlan(input: PublishReleaseInput): Promise<ReleasePlanResult> {
    const { data, error } = await getSupabaseClient().rpc('create_package_release', {
      p_version_id: input.packageVersionId,
      p_target_mode: input.mode,
      p_company_ids: input.companyIds,
      p_automatic_install: input.automaticInstall,
    });
    if (error) throw mapSupabaseError(error, 'admin.packages.release_plan');
    const result = data as unknown as {
      release_id: string; package_key: string; version: string; target_mode: ReleasePlanResult['mode'];
      target_count: number; automatic_install: boolean;
      installations: Array<{ id: string; company_id: string; status: ReleaseInstallationResult['status']; error: string | null }>;
    };
    return {
      releaseId: result.release_id,
      packageCode: result.package_key,
      version: result.version,
      mode: result.target_mode,
      targetCount: result.target_count,
      automaticInstall: result.automatic_install,
      installations: (result.installations ?? []).map((i) => ({ id: i.id, companyId: i.company_id, status: i.status, error: i.error ?? null })),
    };
  }

  async processInstallation(id: string): Promise<ReleaseInstallationResult> {
    const { data, error } = await getSupabaseClient().rpc('process_package_installation', { p_installation_id: id });
    if (error) throw mapSupabaseError(error, 'admin.installations.process');
    const result = data as unknown as { id: string; company_id?: string; status: ReleaseInstallationResult['status']; error: string | null };
    return { id: result.id, companyId: result.company_id ?? '', status: result.status, error: result.error ?? null };
  }

  async getDetails(id: string): Promise<PackageReleaseDetails | undefined> {
    const client = getSupabaseClient();
    const releaseResult = await client.from('package_releases').select('id,package_version_id,target_mode,automatic_install,released_at').eq('id', id).maybeSingle();
    if (releaseResult.error) throw mapSupabaseError(releaseResult.error, 'admin.releases.detail');
    if (!releaseResult.data) return undefined;
    const release = releaseResult.data as unknown as { id: string; package_version_id: string; target_mode: PackageReleaseDetails['mode']; automatic_install: boolean; released_at: string };
    const versionResult = await client.from('package_versions').select('package_key,version').eq('id', release.package_version_id).maybeSingle();
    if (versionResult.error) throw mapSupabaseError(versionResult.error, 'admin.releases.version');
    if (!versionResult.data) return undefined;
    const version = versionResult.data as unknown as { package_key: string; version: string };
    const packageResult = await client.from('packages').select('name,type').eq('key', version.package_key).maybeSingle();
    if (packageResult.error) throw mapSupabaseError(packageResult.error, 'admin.releases.package');
    const pkg = packageResult.data as unknown as { name: string; type: PackageType } | null;
    const installations = await new SupabaseInstallationRepository().list({ releaseId: id });
    return {
      releaseId: release.id,
      packageCode: version.package_key,
      packageName: pkg?.name ?? version.package_key,
      classification: pkg?.type ?? 'standard_update',
      version: version.version,
      mode: release.target_mode,
      releasedAt: release.released_at,
      automaticInstall: release.automatic_install,
      installations,
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
      .select('id,release_id,company_id,package_key,version,status,started_at,completed_at,error,attempt_count,last_error_code,last_error_message,last_attempt_at')
      .order('started_at', { ascending: false });
    if (filters.companyIds?.length) query = query.in('company_id', filters.companyIds);
    if (filters.releaseId) query = query.eq('release_id', filters.releaseId);
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
      attempt_count: number;
      last_error_code: string | null;
      last_error_message: string | null;
      last_attempt_at: string | null;
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
        attemptCount: r.attempt_count ?? 0,
        lastErrorCode: r.last_error_code ?? null,
        lastErrorMessage: r.last_error_message ?? null,
        lastAttemptAt: r.last_attempt_at ?? null,
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
