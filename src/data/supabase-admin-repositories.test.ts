import { beforeEach, describe, expect, it, vi } from 'vitest';

type Response = { data: unknown; error: unknown };

const client = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => client,
}));

import { SupabaseRepository } from './supabase-repository';
import { SupabaseAuditRepository } from './audit/supabase-audit-repository';
import { SupabaseDiagnosticRepository } from './diagnostics/supabase-diagnostic-repository';
import { SupabaseHealthRepository } from './health/supabase-health-repository';
import { SupabaseInstallationRepository, SupabasePackageRepository } from './packages/supabase';
import { SupabaseUsageRepository } from './usage/supabase-usage-repository';

function query(response: Response) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return builder;
}

function configureFrom(responses: Record<string, Response>) {
  client.from.mockImplementation((table: string) => query(responses[table] ?? { data: [], error: null }));
}

describe('Supabase admin repository resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.rpc.mockReset();
  });

  it('returns an empty company list without querying optional tables', async () => {
    configureFrom({ companies: { data: [], error: null } });

    const result = await new SupabaseRepository().getCompanies();

    expect(result).toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('keeps companies visible when optional enrichment queries fail', async () => {
    configureFrom({
      companies: {
        data: [{
          id: 'company-1',
          name: 'Example Company',
          slug: 'example',
          subdomain: 'example',
          status: 'active',
          created_at: '2026-07-26T00:00:00Z',
        }],
        error: null,
      },
      company_packages: { data: null, error: { code: '42501', status: 403, message: 'denied' } },
      employees: { data: null, error: { code: 'PGRST000', status: 500, message: 'temporary' } },
      company_settings: { data: null, error: { code: 'PGRST000', status: 500, message: 'temporary' } },
      packages: { data: null, error: { code: 'PGRST000', status: 500, message: 'temporary' } },
    });

    await expect(new SupabaseRepository().getCompanies()).resolves.toEqual([{
      id: 'company-1',
      name: 'Example Company',
      slug: 'example',
      subdomain: 'example',
      status: 'active',
      adminEmail: '',
      employeeCount: 0,
      createdAt: '2026-07-26',
      packages: [],
    }]);
  });

  it('normalizes empty platform lists and RPC results', async () => {
    configureFrom({
      packages: { data: null, error: null },
      package_installations: { data: null, error: null },
      diagnostic_reports: { data: [], error: null },
    });
    client.rpc.mockResolvedValue({ data: null, error: null });

    await expect(new SupabasePackageRepository().list()).resolves.toEqual([]);
    await expect(new SupabaseInstallationRepository().list()).resolves.toEqual([]);
    await expect(new SupabaseUsageRepository().list()).resolves.toEqual([]);
    await expect(new SupabaseHealthRepository().list()).resolves.toEqual([]);
    await expect(new SupabaseAuditRepository().list()).resolves.toEqual([]);
    await expect(new SupabaseDiagnosticRepository().list()).resolves.toEqual([]);
  });

  it('does not send mock diagnostic IDs to Supabase mode', async () => {
    configureFrom({});

    await expect(new SupabaseDiagnosticRepository().getById('diag-leave')).resolves.toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('exposes every generic Repository read method on the aggregate adapter', () => {
    const repository = new SupabaseRepository();
    const methods = [
      'getCompanies',
      'getCompany',
      'getRequests',
      'getRequest',
      'getPackages',
      'getPackage',
      'getDiagnostic',
      'getDiagnostics',
      'getInstallations',
      'getUsage',
      'getHealth',
      'getAudit',
      'getEmployees',
      'getEmployee',
      'getDepartments',
      'getPositions',
      'getCompanyUsers',
      'getInstallationsForTenant',
      'getLeaveRequests',
      'getAttendance',
    ] as const;

    for (const method of methods) {
      expect(typeof repository[method]).toBe('function');
    }
  });
});
