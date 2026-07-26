import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepository } from './repository';

const supabaseRepositoryMock = vi.hoisted(() => ({
  getCompanies: vi.fn(),
  getPackages: vi.fn(),
  getUsage: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('./supabase-repository', () => ({
  SupabaseRepository: class {
    getCompanies = supabaseRepositoryMock.getCompanies;
    getPackages = supabaseRepositoryMock.getPackages;
    getUsage = supabaseRepositoryMock.getUsage;
    saveSettings = supabaseRepositoryMock.saveSettings;
  },
}));

const repositoryMethods = [
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
  'createEmployee',
  'disableDepartment',
  'createRequest',
  'changeRequestStatus',
  'createPackage',
  'assignPackage',
  'saveSettings',
  'installPackage',
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseRepositoryMock.getCompanies.mockResolvedValue([]);
  supabaseRepositoryMock.getPackages.mockResolvedValue([]);
  supabaseRepositoryMock.getUsage.mockResolvedValue([]);
  supabaseRepositoryMock.saveSettings.mockResolvedValue({});
});

describe('repository factory', () => {
  it('selects a lazy Supabase adapter without throwing', () => {
    expect(() => createRepository('supabase')).not.toThrow();
  });

  it('keeps every public adapter method callback-safe', () => {
    const repository = createRepository('supabase');

    repositoryMethods.forEach((method) => {
      expect(Object.prototype.hasOwnProperty.call(repository, method)).toBe(true);
      expect(typeof repository[method]).toBe('function');
    });
  });

  it('keeps detached aggregate queries bound to the lazy adapter', async () => {
    const repository = createRepository('supabase');
    const getCompanies = repository.getCompanies;
    const getPackages = repository.getPackages;
    const getUsage = repository.getUsage;

    await expect(getCompanies()).resolves.toEqual([]);
    await expect(getPackages()).resolves.toEqual([]);
    await expect(getUsage()).resolves.toEqual([]);
    expect(supabaseRepositoryMock.getCompanies).toHaveBeenCalledOnce();
    expect(supabaseRepositoryMock.getPackages).toHaveBeenCalledOnce();
    expect(supabaseRepositoryMock.getUsage).toHaveBeenCalledOnce();
  });

  it('forwards a detached settings mutation to the Supabase adapter', async () => {
    const settings = { companyName: 'Updated company' };
    supabaseRepositoryMock.saveSettings.mockResolvedValue(settings);
    const repository = createRepository('supabase');
    const saveSettings = repository.saveSettings;

    await expect(saveSettings(settings)).resolves.toEqual(settings);
    expect(supabaseRepositoryMock.saveSettings).toHaveBeenCalledWith(settings);
  });
});
