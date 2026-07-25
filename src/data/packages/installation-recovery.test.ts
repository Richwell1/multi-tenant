import { describe, it, expect } from 'vitest';
import { MockInstallationRepository } from './mock';
import { canRetryInstallation, canRollbackInstallation } from './types';
import { installationService } from '@/services/package-service';
import { invalidationTargets } from '@/data/invalidation';
import { queryKeys } from '@/lib/query-keys';

describe('installation recovery guards', () => {
  it('only a failed install is retryable', () => {
    expect(canRetryInstallation('failed')).toBe(true);
    expect(canRetryInstallation('installed')).toBe(false);
    expect(canRetryInstallation('rolled_back')).toBe(false);
  });

  it('only an installed package is rollback-able', () => {
    expect(canRollbackInstallation('installed')).toBe(true);
    expect(canRollbackInstallation('failed')).toBe(false);
    expect(canRollbackInstallation('rolled_back')).toBe(false);
  });
});

describe('MockInstallationRepository recovery', () => {
  const repo = new MockInstallationRepository();

  it('retry resolves to installed', async () => {
    expect(await repo.retry('i-1')).toEqual({ id: 'i-1', status: 'installed' });
  });

  it('rollback resolves to rolled_back', async () => {
    expect(await repo.rollback('i-1')).toEqual({ id: 'i-1', status: 'rolled_back' });
  });
});

describe('installationService recovery', () => {
  it('delegates retry/rollback to the repository (RPC authorizes server-side)', async () => {
    expect((await installationService.retry('i-2')).status).toBe('installed');
    expect((await installationService.rollback('i-2')).status).toBe('rolled_back');
  });
});

describe('recovery cache invalidation', () => {
  it('refreshes installations, the company entitlement, and audit', () => {
    const targets = invalidationTargets.recoverInstallation('alpha');
    expect(targets).toContainEqual(queryKeys.installations.all);
    expect(targets).toContainEqual(queryKeys.packages.company('alpha'));
    expect(targets).toContainEqual(queryKeys.audit.all);
  });
});
