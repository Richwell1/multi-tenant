import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
import { compareSemver } from '@/lib/semver';
import type { AdoptionRow, MarketplaceInstallResult, MarketplacePackage, MarketplaceRepository } from './index';

export class SupabaseMarketplaceRepository implements MarketplaceRepository {
  async list(): Promise<MarketplacePackage[]> {
    const client = getSupabaseClient();
    // RLS restricts this to marketplace packages the company may discover.
    const { data, error } = await client
      .from('packages')
      .select('key,name,description,category,is_active,package_versions(version,released_at)')
      .eq('category', 'marketplace_extension')
      .eq('is_active', true)
      .order('name');
    if (error) throw mapSupabaseError(error);
    const rows = (data ?? []) as unknown as Array<{
      key: string;
      name: string;
      description: string | null;
      package_versions: Array<{ version: string; released_at: string | null }> | null;
    }>;
    return rows.map((r) => {
      const released = (r.package_versions ?? []).filter((v) => v.released_at);
      const latest = released.sort((a, b) => compareSemver(b.version, a.version))[0]?.version ?? null;
      return { code: r.key, name: r.name, description: r.description ?? '', latestVersion: latest };
    });
  }

  async install(packageKey: string): Promise<MarketplaceInstallResult> {
    const { data, error } = await getSupabaseClient().rpc('install_marketplace_extension', {
      p_package_key: packageKey,
    });
    if (error) throw mapSupabaseError(error, 'company.marketplace.install');
    const r = data as unknown as { package_key: string; installed_version: string };
    return { packageKey: r.package_key, version: r.installed_version };
  }

  async adoption(): Promise<AdoptionRow[]> {
    const { data, error } = await getSupabaseClient().rpc('marketplace_adoption');
    if (error) throw mapSupabaseError(error, 'admin.marketplace.adoption');
    const rows = (data ?? []) as unknown as Array<{
      package_key: string;
      package_name: string;
      install_count: number;
      distinct_companies: number;
    }>;
    return rows.map((r) => ({
      packageKey: r.package_key,
      packageName: r.package_name,
      installCount: Number(r.install_count),
      distinctCompanies: Number(r.distinct_companies),
    }));
  }
}
