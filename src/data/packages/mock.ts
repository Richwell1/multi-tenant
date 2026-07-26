import { companies, installations, packages } from '@/data/mock';
import { RepositoryError } from '@/data/errors';
import { toPackageCategory } from '@/lib/packages/category';
import type {
  CreatePackageInput,
  CreateVersionInput,
  CreatedPackage,
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
  ReleaseInstallationResult,
  ReleasePlanResult,
  PackageReleaseDetails,
} from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;
const versionId = (code: string, version: string) => `${code}-${version}`;
const createdPackages: Package[] = [];
const createdVersions = new Map<string, PackageVersion[]>();
const plans = new Map<string, PackageReleaseDetails>();

export class MockPackageRepository implements PackageRepository {
  async list(): Promise<Package[]> {
    await delay();
    return [...packages.map((p) => ({
      code: p.key,
      name: p.name,
      description: p.releaseNotes,
      classification: p.type,
      category: toPackageCategory({ type: p.type }),
      basePackageKey: null,
      isActive: p.status !== 'deprecated',
    })), ...createdPackages];
  }
  async getByCode(code: string): Promise<Package | undefined> {
    return (await this.list()).find((p) => p.code === code);
  }
  async listVersions(packageCode: string): Promise<PackageVersion[]> {
    await delay();
    const pkg = packages.find((p) => p.key === packageCode);
    const seeded = (pkg?.history ?? []).map((h) => ({
      id: versionId(packageCode, h.version),
      packageCode,
      version: h.version,
      releaseNotes: h.notes,
      compatibilityNotes: '',
      diagnosticStatus: null,
      releasedAt: h.releasedAt || null,
    }));
    return [...seeded, ...(createdVersions.get(packageCode) ?? [])];
  }
  async createPackage(input: CreatePackageInput): Promise<CreatedPackage> {
    await delay();
    const existing = await this.list();
    if (existing.some((pkg) => pkg.code === input.code)) {
      throw new RepositoryError('That package key is already taken.', 'conflict');
    }
    // Private extensions must depend on an existing, active base package.
    if (input.classification === 'private_extension') {
      const base = input.baseCode?.trim();
      if (!base) {
        throw new RepositoryError('A private extension requires a base package.', 'validation');
      }
      if (base === input.code) {
        throw new RepositoryError('A package cannot be its own base package.', 'validation');
      }
      if (!existing.some((pkg) => pkg.code === base && pkg.isActive)) {
        throw new RepositoryError('The base package was not found or is inactive.', 'not_found');
      }
    }
    const created: Package = {
      code: input.code,
      name: input.name,
      description: input.description,
      classification: input.classification,
      category: toPackageCategory({ type: input.classification }),
      basePackageKey: input.baseCode ?? null,
      isActive: true,
    };
    const version: PackageVersion = {
      id: versionId(input.code, input.version),
      packageCode: input.code,
      version: input.version,
      releaseNotes: input.releaseNotes,
      compatibilityNotes: '',
      diagnosticStatus: null,
      releasedAt: null,
    };
    createdPackages.push(created);
    createdVersions.set(input.code, [version]);
    return { package: created, version };
  }
  async createVersion(input: CreateVersionInput): Promise<PackageVersion> {
    await delay();
    if (!(await this.getByCode(input.packageCode))?.isActive) {
      throw new RepositoryError('Package not found or inactive.', 'not_found');
    }
    if ((await this.listVersions(input.packageCode)).some((item) => item.version === input.version)) {
      throw new RepositoryError('That package version already exists.', 'conflict');
    }
    const version: PackageVersion = {
      id: versionId(input.packageCode, input.version),
      packageCode: input.packageCode,
      version: input.version,
      releaseNotes: input.releaseNotes,
      compatibilityNotes: input.compatibilityNotes,
      diagnosticStatus: null,
      releasedAt: null,
    };
    createdVersions.set(input.packageCode, [...(createdVersions.get(input.packageCode) ?? []), version]);
    return version;
  }
}

export class MockPackageReleaseRepository implements PackageReleaseRepository {
  constructor(private readonly failCompanies: Set<string> = new Set()) {}

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

  async createPlan(input: PublishReleaseInput): Promise<ReleasePlanResult> {
    await delay();
    const parsed = /^(.*)-([0-9]+\.[0-9]+\.[0-9]+)$/.exec(input.packageVersionId);
    const code = parsed?.[1] ?? '(unknown)';
    const version = parsed?.[2] ?? '0.0.0';
    const ids = input.mode === 'all_companies'
      ? companies.filter((c) => c.status === 'active').map((c) => c.id)
      : input.companyIds;
    const releaseId = `rel-${Date.now()}`;
    const installations = ids.map((companyId, index) => ({
      id: `${releaseId}-install-${index}`,
      companyId,
      status: 'pending' as const,
      error: null,
    }));
    plans.set(releaseId, {
      releaseId,
      packageCode: code,
      packageName: code,
      classification: 'standard_update',
      version,
      mode: input.mode,
      releasedAt: new Date().toISOString(),
      automaticInstall: input.automaticInstall,
      installations: installations.map((i) => ({
        ...i,
        releaseId,
        packageCode: code,
        companyName: companyName(i.companyId),
        version,
        startedAt: new Date().toISOString(),
        completedAt: null,
        attemptCount: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastAttemptAt: null,
      })),
    });
    return { releaseId, packageCode: code, version, mode: input.mode, targetCount: ids.length, automaticInstall: input.automaticInstall, installations };
  }

  async processInstallation(id: string): Promise<ReleaseInstallationResult> {
    await delay();
    for (const details of plans.values()) {
      const installation = details.installations.find((item) => item.id === id);
      if (installation) {
        if (this.failCompanies.has(installation.companyId)) {
          installation.status = 'failed';
          installation.error = 'Installation could not be completed.';
          installation.lastErrorMessage = installation.error;
          installation.lastErrorCode = 'installation_failed';
          installation.attemptCount += 1;
          installation.lastAttemptAt = new Date().toISOString();
          return { id, companyId: installation.companyId, status: 'failed', error: installation.error };
        }
        installation.status = 'installed';
        installation.completedAt = new Date().toISOString();
        installation.attemptCount += 1;
        installation.lastAttemptAt = new Date().toISOString();
        return { id, companyId: installation.companyId, status: 'installed', error: null };
      }
    }
    return { id, companyId: '', status: 'failed', error: 'Installation could not be completed.' };
  }

  async getDetails(id: string): Promise<PackageReleaseDetails | undefined> {
    await delay();
    return plans.get(id);
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
      .filter((i) => !filters.releaseId || `rel-${i.id}` === filters.releaseId)
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
        attemptCount: i.state === 'installed' ? 1 : 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastAttemptAt: i.activatedAt,
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
