import type { DiagnosticReport, RunDiagnosticInput } from './types';

/** Platform-plane diagnostics access. RLS restricts every operation to Platform Admins. */
export interface DiagnosticRepository {
  list(): Promise<DiagnosticReport[]>;
  getById(id: string): Promise<DiagnosticReport | undefined>;
  /** Evaluate a package version — creates a report with the eight dimension checks. */
  run(input: RunDiagnosticInput): Promise<DiagnosticReport>;
}
