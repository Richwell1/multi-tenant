import type { DiagnosticCheck, DiagnosticDimension, DiagnosticReport, DiagnosticResult } from '@/data/types';

export type { DiagnosticCheck, DiagnosticDimension, DiagnosticReport, DiagnosticResult };

/** The eight dimensions every diagnostic evaluates, in display order. */
export const DIAGNOSTIC_DIMENSIONS: readonly DiagnosticDimension[] = [
  'frontend',
  'backend',
  'database',
  'security',
  'dependency',
  'data_impact',
  'rollback',
  'test_evidence',
];

export interface RunDiagnosticInput {
  packageVersionId: string;
  summary?: string;
  recommendation?: string;
}
