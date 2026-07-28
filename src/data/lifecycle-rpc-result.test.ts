// ---------------------------------------------------------------------------
// assertLifecycleRpcSucceeded — the frontend half of the lifecycle logging
// contract.
//
// install / update / rollback report an apply-phase failure by RETURNING
// `status: 'failed'` rather than raising, because a failure cannot be logged
// from inside the transaction it aborts. Without this guard the repositories
// would read a failed operation as a success.
// ---------------------------------------------------------------------------
import { describe, expect, it, vi } from 'vitest';
import { assertLifecycleRpcSucceeded, RepositoryError } from './errors';

describe('assertLifecycleRpcSucceeded', () => {
  it('passes through a successful payload', () => {
    expect(() =>
      assertLifecycleRpcSucceeded({ status: 'installed', package_key: 'document-notes' }, 'op'),
    ).not.toThrow();
  });

  it('passes through payloads that carry no status at all', () => {
    expect(() => assertLifecycleRpcSucceeded({ package_key: 'document-notes' }, 'op')).not.toThrow();
    expect(() => assertLifecycleRpcSucceeded(null, 'op')).not.toThrow();
    expect(() => assertLifecycleRpcSucceeded(undefined, 'op')).not.toThrow();
  });

  it('throws a RepositoryError when the operation failed', () => {
    expect(() => assertLifecycleRpcSucceeded({ status: 'failed', error: 'company_not_active' }, 'op')).toThrow(
      RepositoryError,
    );
  });

  it('maps a known category to user-facing copy and the right kind', () => {
    try {
      assertLifecycleRpcSucceeded({ status: 'failed', error: 'not_authorized' }, 'op');
      expect.unreachable('should have thrown');
    } catch (e) {
      const error = e as RepositoryError;
      expect(error.message).toBe('You are not authorized to perform this action.');
      expect(error.kind).toBe('forbidden');
    }
  });

  it('maps dependency failures to actionable copy', () => {
    try {
      assertLifecycleRpcSucceeded({ status: 'failed', error: 'base_version_too_low' }, 'op');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as RepositoryError).message).toBe('The base package must be updated first.');
      expect((e as RepositoryError).kind).toBe('validation');
    }
  });

  it('falls back to a generic message for an unrecognized category, leaking nothing', () => {
    try {
      // A category this frontend build has never heard of.
      assertLifecycleRpcSucceeded({ status: 'failed', error: 'some_new_backend_category' }, 'op');
      expect.unreachable('should have thrown');
    } catch (e) {
      const error = e as RepositoryError;
      expect(error.message).toBe('That action could not be completed. Please try again.');
      expect(error.message).not.toContain('some_new_backend_category');
    }
  });

  it('handles a failure with no category at all', () => {
    expect(() => assertLifecycleRpcSucceeded({ status: 'failed' }, 'op')).toThrow(
      'That action could not be completed. Please try again.',
    );
  });

  it('records the failure category in the dev diagnostics log', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      assertLifecycleRpcSucceeded({ status: 'failed', error: 'package_inactive' }, 'company.marketplace.install');
    } catch {
      /* expected */
    }

    expect(spy).toHaveBeenCalledWith(
      '[supabase]',
      expect.objectContaining({ operation: 'company.marketplace.install', code: 'package_inactive' }),
    );
    spy.mockRestore();
  });
});
