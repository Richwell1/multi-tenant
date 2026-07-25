import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
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
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Array<{ key: string; name: string; description: string | null; type: PackageType; is_active: boolean }>).map(
      (r) => ({ code: r.key, name: r.name, description: r.description ?? '', classification: r.type, isActive: r.is_active }),
    );
  }
  async getByCode(code: string): Promise<Package | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('packages')
      .select('key,name,description,type,is_active')
      .eq('key', code)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
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
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Array<{ id: string; package_key: string; version: string; notes: string; diagnostic_status: PackageDiagnosticStatus | null; released_at: string | null }>).map(
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
    if (error) throw mapSupabaseError(error);
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
    const { data, error } = await getSupabaseClient()
      .from('company_packages')
      .select('company_id,package_key,package_version,enabled,status,assigned_at,packages(name)')
      .eq('company_id', companyId);
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Array<{ company_id: string; package_key: string; package_version: string | null; enabled: boolean; status: string; assigned_at: string | null; packages: { name: string } | null }>).map(
      (r) => ({
        companyId: r.company_id,
        packageCode: r.package_key,
        packageName: r.packages?.name ?? r.package_key,
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
    let query = getSupabaseClient()
      .from('package_installations')
      .select('id,release_id,company_id,package_key,version,status,started_at,completed_at,error,companies(name)')
      .order('started_at', { ascending: false });
    if (filters.companyIds?.length) query = query.in('company_id', filters.companyIds);
    if (filters.packageCode) query = query.eq('package_key', filters.packageCode);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Array<{ id: string; release_id: string; company_id: string; package_key: string; version: string; status: PackageInstallationStatus; started_at: string; completed_at: string | null; error: string | null; companies: { name: string } | null }>).map(
      (r) => ({
        id: r.id,
        releaseId: r.release_id,
        companyId: r.company_id,
        companyName: r.companies?.name ?? r.company_id,
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
    if (error) throw mapSupabaseError(error);
    return data as unknown as InstallationRecoveryResult;
  }

  async rollback(id: string): Promise<InstallationRecoveryResult> {
    const { data, error } = await getSupabaseClient().rpc('rollback_package_installation', {
      p_installation_id: id,
    });
    if (error) throw mapSupabaseError(error);
    return data as unknown as InstallationRecoveryResult;
  }
}
