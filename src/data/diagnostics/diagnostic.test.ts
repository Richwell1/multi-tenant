import { describe, it, expect } from 'vitest';
import { MockDiagnosticRepository } from './mock-diagnostic-repository';
import { deriveResult, isReleaseBlocked } from './result';
import { DIAGNOSTIC_DIMENSIONS } from './types';
import { diagnosticService } from '@/services/diagnostic-service';
import { invalidationTargets } from '@/data/invalidation';
import { queryKeys } from '@/lib/query-keys';
import type { DiagnosticCheck } from './types';

const check = (status: DiagnosticCheck['status'], required = true): DiagnosticCheck => ({
  dimension: 'security',
  status,
  required,
  detail: '',
});

describe('diagnostic result derivation', () => {
  it('is FAIL if any check fails, else WARN if any warns, else PASS', () => {
    expect(deriveResult([check('PASS'), check('WARN'), check('FAIL')])).toBe('FAIL');
    expect(deriveResult([check('PASS'), check('WARN')])).toBe('WARN');
    expect(deriveResult([check('PASS'), check('PASS')])).toBe('PASS');
    expect(deriveResult([])).toBe('PASS');
  });
});

describe('release gate', () => {
  it('blocks only when a REQUIRED check is FAIL', () => {
    expect(isReleaseBlocked([check('FAIL', true)])).toBe(true);
    expect(isReleaseBlocked([check('FAIL', false)])).toBe(false); // advisory FAIL does not block
    expect(isReleaseBlocked([check('WARN', true)])).toBe(false); // WARN requires review, not block
    expect(isReleaseBlocked([check('PASS', true)])).toBe(false);
  });
});

describe('MockDiagnosticRepository', () => {
  const repo = new MockDiagnosticRepository();

  it('lists seeded diagnostics', async () => {
    const all = await repo.list();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0].checks.length).toBe(DIAGNOSTIC_DIMENSIONS.length);
  });

  it('run evaluates all eight dimensions and derives PASS', async () => {
    const report = await repo.run({ packageVersionId: 'v-1' });
    expect(report.checks).toHaveLength(8);
    expect(report.result).toBe('PASS');
    expect(report.packageVersionId).toBe('v-1');
  });
});

describe('diagnosticService', () => {
  it('rejects running a diagnostic without a version', async () => {
    await expect(diagnosticService.run({ packageVersionId: '' })).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

describe('diagnostic cache invalidation', () => {
  it('running a diagnostic refreshes packages (release gate) and audit', () => {
    const targets = invalidationTargets.runDiagnostic();
    expect(targets).toContainEqual(queryKeys.diagnostics.all);
    expect(targets).toContainEqual(queryKeys.packages.all);
    expect(targets).toContainEqual(queryKeys.audit.all);
  });
});
