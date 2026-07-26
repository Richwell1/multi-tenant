import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import { toPackageCategory } from '@/lib/packages/category';
import type { PackageType } from '@/data/types';
import type { AvailableUpdate, CompanyUpdatesRepository, InstallUpdateResult } from './index';

interface Row {
  release_id: string;
  installation_id: string;
  package_key: string;
  package_name: string;
  category: string | null;
  installed_version: string | null;
  available_version: string;
  base_package_name: string | null;
  release_notes: string;
  released_at: string | null;
  installation_state: string;
  update_policy: string;
  automatic_install: boolean;
}

const toDomain = (r: Row): AvailableUpdate => ({
  releaseId: r.release_id,
  installationId: r.installation_id,
  packageKey: r.package_key,
  packageName: r.package_name,
  category: toPackageCategory({ category: r.category, type: null as unknown as PackageType }),
  installedVersion: r.installed_version,
  availableVersion: r.available_version,
  basePackageName: r.base_package_name,
  releaseNotes: r.release_notes ?? '',
  releasedAt: r.released_at,
  installationState: r.installation_state,
  updatePolicy: r.update_policy,
  automaticInstall: r.automatic_install,
});

export class SupabaseCompanyUpdatesRepository implements CompanyUpdatesRepository {
  async list(): Promise<AvailableUpdate[]> {
    // The RPC self-scopes to the caller's active company (membership-derived).
    const { data, error } = await getSupabaseClient().rpc('company_available_updates');
    if (error) throw mapSupabaseError(error, 'company.updates.list');
    return ((data ?? []) as unknown as Row[]).map(toDomain);
  }

  async install(installationId: string): Promise<InstallUpdateResult> {
    const { data, error } = await getSupabaseClient().rpc('install_company_update', {
      p_installation_id: installationId,
    });
    if (error) throw mapSupabaseError(error, 'company.updates.install');
    const r = data as unknown as { installation_id: string; package_key: string; version: string };
    return { installationId: r.installation_id, packageKey: r.package_key, version: r.version };
  }
}
