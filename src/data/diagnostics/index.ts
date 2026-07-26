import { resolveDataSource } from '@/data/repository';
import { MockDiagnosticRepository } from './mock-diagnostic-repository';
import type { DiagnosticRepository } from './diagnostic-repository';
import type { RunDiagnosticInput } from './types';

class LazySupabaseDiagnosticRepository implements DiagnosticRepository {
  private impl = () => {
    return import('./supabase-diagnostic-repository').then(
      (m) => new m.SupabaseDiagnosticRepository(),
    );
  };
  list = () => {
    return this.impl().then((r) => r.list());
  };
  getById = (id: string) => {
    return this.impl().then((r) => r.getById(id));
  };
  run = (input: RunDiagnosticInput) => {
    return this.impl().then((r) => r.run(input));
  };
}

export function createDiagnosticRepository(source = resolveDataSource()): DiagnosticRepository {
  return source === 'supabase'
    ? new LazySupabaseDiagnosticRepository()
    : new MockDiagnosticRepository();
}

export const diagnosticRepository: DiagnosticRepository = createDiagnosticRepository();

export type { DiagnosticRepository } from './diagnostic-repository';
export type {
  DiagnosticReport,
  DiagnosticCheck,
  DiagnosticDimension,
  DiagnosticResult,
  RunDiagnosticInput,
} from './types';
export { DIAGNOSTIC_DIMENSIONS } from './types';
export { deriveResult, isReleaseBlocked } from './result';
