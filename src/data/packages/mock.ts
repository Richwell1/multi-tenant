import { companies, installations, packages } from '@/data/mock';
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
  PackageInstallation,
  PackageInstallationStatus,
  PackageVersion,
  PublishReleaseInput,
  PublishReleaseResult,
} from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;
const versionId = (code: string, version: string) => `${code}-${version}`;

export class MockPackageRepository implements PackageRepository {
  async list(): Promise<Package[]> {
    await delay();
    return packages.map((p) => ({
      code: p.key,
      name: p.name,
      description: p.releaseNotes,
      classification: p.type,
      isActive: p.status !== 'deprecated',
    }));
  }
  async getByCode(code: string): Promise<Package | undefined> {
    return (await this.list()).find((p) => p.code === code);
  }
  async listVersions(packageCode: string): Promise<PackageVersion[]> {
    await delay();
    const pkg = packages.find((p) => p.key === packageCode);
    return (pkg?.history ?? []).map((h) => ({
      id: versionId(packageCode, h.version),
      packageCode,
      version: h.version,
      releaseNotes: h.notes,
      diagnosticStatus: null,
      releasedAt: h.releasedAt || null,
    }));
  }
}

export class MockPackageReleaseRepository implements PackageReleaseRepository {
  async publish(input: PublishReleaseInput): Promise<PublishReleaseResult> {
    await delay();
    const parsed = /^(.*)-(\d+\.\d+\.\d+)$/.exec(input.packageVersionId);
    const code = parsed?.[1] ?? '(unknown)';
    const version = parsed?.[2] ?? '0.0.0';
    const targetCount =
      input.mode === 'all_companies'
        ? companies.filter((c) => c.status === 'active').length
        : input.companyIds.length;
    return {
      releaseId: `rel-${Date.now()}`,
      packageCode: code,
      version,
      mode: input.mode,
      targetCount,
      automaticInstall: input.automaticInstall,
    };
  }
}

export class MockPackageAssignmentRepository implements PackageAssignmentRepository {
  async listForCompany(companyId: string): Promise<CompanyPackageAssignment[]> {
    await delay();
    const company = companies.find((c) => c.id === companyId);
    return (company?.packages ?? []).map((code) => ({
      companyId,
      packageCode: code,
      packageName: packages.find((p) => p.key === code)?.name ?? code,
      version: '1.0.0',
      enabled: true,
      status: 'installed',
      assignedAt: company?.createdAt ?? null,
    }));
  }
}

const toStatus = (state: string): PackageInstallationStatus =>
  state === 'installed' || state === 'failed' || state === 'installing' ? state : 'pending';

export class MockInstallationRepository implements InstallationRepository {
  async list(filters: InstallationFilters = {}): Promise<PackageInstallation[]> {
    await delay();
    return installations
      .filter((i) => !filters.companyIds?.length || filters.companyIds.includes(i.companyId))
      .filter((i) => !filters.packageCode || i.packageKey === filters.packageCode)
      .map((i) => ({
        id: i.id,
        releaseId: `rel-${i.id}`,
        companyId: i.companyId,
        companyName: companyName(i.companyId),
        packageCode: i.packageKey,
        version: i.packageVersion,
        status: toStatus(i.state),
        startedAt: i.assignedAt,
        completedAt: i.activatedAt,
        error: null,
      }))
      .filter((i) => !filters.status || i.status === filters.status);
  }

  async retry(id: string): Promise<InstallationRecoveryResult> {
    await delay();
    return { id, status: 'installed' };
  }

  async rollback(id: string): Promise<InstallationRecoveryResult> {
    await delay();
    return { id, status: 'rolled_back' };
  }
}
