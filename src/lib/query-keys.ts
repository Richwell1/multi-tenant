// ---------------------------------------------------------------------------
// Centralized, typed query-key factory.
//
// Every TENANT-OWNED key embeds the company/tenant id so Alpha and Beta data can
// never collide in the cache. Global platform data (companies, packages, usage,
// health, audit) is keyed without a tenant id by design.
// ---------------------------------------------------------------------------

import type { CompanyTargetMode } from './company-target';

export interface CompanyFilters {
  search?: string;
  status?: 'active' | 'suspended';
}
export interface EmployeeFilters {
  search?: string;
}

/** Stable fragment describing a company-target selection inside a query key. */
export interface CompanyTargetKeyPart {
  targetMode: CompanyTargetMode;
  companyIds: string[];
}

export const queryKeys = {
  companies: {
    all: ['companies'] as const,
    list: (filters?: CompanyFilters) => ['companies', 'list', filters ?? {}] as const,
    detail: (companyId: string) => ['companies', 'detail', companyId] as const,
  },
  employees: {
    all: (companyId: string) => ['employees', companyId] as const,
    list: (companyId: string, filters?: EmployeeFilters) =>
      ['employees', companyId, 'list', filters ?? {}] as const,
    detail: (companyId: string, employeeId: string) =>
      ['employees', companyId, 'detail', employeeId] as const,
  },
  departments: {
    all: (companyId: string) => ['departments', companyId] as const,
  },
  positions: {
    all: (companyId: string) => ['positions', companyId] as const,
    list: (companyId: string, filters?: EmployeeFilters) =>
      ['positions', companyId, 'list', filters ?? {}] as const,
    detail: (companyId: string, positionId: string) =>
      ['positions', companyId, 'detail', positionId] as const,
  },
  users: {
    all: (companyId: string) => ['users', companyId] as const,
  },
  requests: {
    all: ['requests'] as const,
    detail: (requestId: string) => ['requests', 'detail', requestId] as const,
  },
  packages: {
    all: ['packages'] as const,
    detail: (packageKey: string) => ['packages', 'detail', packageKey] as const,
    /** A single company's package entitlements. */
    company: (companyId: string) => ['packages', 'company', companyId] as const,
  },
  diagnostics: {
    detail: (diagnosticId: string) => ['diagnostics', 'detail', diagnosticId] as const,
    list: (target: CompanyTargetKeyPart) => ['diagnostics', 'list', target] as const,
  },
  installations: {
    all: ['installations'] as const,
    company: (companyId: string) => ['installations', 'company', companyId] as const,
    list: (target: CompanyTargetKeyPart) => ['installations', 'list', target] as const,
  },
  context: {
    platformAdmin: (userId: string) => ['context', 'platform-admin', userId] as const,
    company: (userId: string) => ['context', 'company', userId] as const,
  },
  usage: {
    all: ['usage'] as const,
    summary: (target: CompanyTargetKeyPart) => ['usage', 'summary', target] as const,
  },
  health: { all: ['health'] as const },
  audit: {
    all: ['audit'] as const,
    list: (target: CompanyTargetKeyPart) => ['audit', 'list', target] as const,
  },
  leave: {
    all: (companyId: string) => ['leave', companyId] as const,
    list: (companyId: string) => ['leave', companyId, 'list'] as const,
  },
  attendance: { all: (companyId: string) => ['attendance', companyId] as const },
} as const;
