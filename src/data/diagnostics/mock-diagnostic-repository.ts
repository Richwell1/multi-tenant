import { diagnostics } from '@/data/mock';
import { DIAGNOSTIC_DIMENSIONS } from './types';
import { deriveResult } from './result';
import type { DiagnosticRepository } from './diagnostic-repository';
import type { DiagnosticReport, RunDiagnosticInput } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

/** Mock adapter — reads the static seed; `run` returns a fresh all-PASS report. */
export class MockDiagnosticRepository implements DiagnosticRepository {
  async list(): Promise<DiagnosticReport[]> {
    await delay();
    return clone(diagnostics);
  }

  async getById(id: string): Promise<DiagnosticReport | undefined> {
    await delay();
    return clone(diagnostics.find((d) => d.id === id) ?? diagnostics[0]);
  }

  async run(input: RunDiagnosticInput): Promise<DiagnosticReport> {
    await delay();
    const checks = DIAGNOSTIC_DIMENSIONS.map((dimension) => ({
      dimension,
      status: 'PASS' as const,
      required: true,
      detail: 'No issues detected.',
    }));
    return {
      id: `diag-${Date.now()}`,
      packageKey: 'hr-core',
      packageVersionId: input.packageVersionId,
      targetCompanyId: null,
      affectedFrontend: [],
      affectedBackend: [],
      affectedTables: [],
      requiredPermissions: [],
      dependencies: [],
      estimatedDataImpact: 'none',
      compatibility: '',
      result: deriveResult(checks),
      recommendation: input.recommendation ?? 'Safe to release.',
      checks,
    };
  }
}
