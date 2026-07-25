import type { DiagnosticCheck, DiagnosticResult } from './types';

// Single source of truth for deriving a report's overall result from its checks,
// mirrored by the DB function `public.recompute_diagnostic_result`.
export function deriveResult(checks: readonly DiagnosticCheck[]): DiagnosticResult {
  if (checks.some((c) => c.status === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.status === 'WARN')) return 'WARN';
  return 'PASS';
}

/** Release is blocked when any REQUIRED check is FAIL — mirrors `version_release_blocked`. */
export function isReleaseBlocked(checks: readonly DiagnosticCheck[]): boolean {
  return checks.some((c) => c.required && c.status === 'FAIL');
}
