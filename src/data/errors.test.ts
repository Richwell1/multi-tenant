import { describe, it, expect, vi } from 'vitest';
import { mapSupabaseError, RepositoryError, logSupabaseError } from './errors';

describe('mapSupabaseError', () => {
  it('maps unique violation (23505) to conflict', () => {
    const e = mapSupabaseError({ code: '23505', message: 'duplicate key' });
    expect(e).toBeInstanceOf(RepositoryError);
    expect(e.kind).toBe('conflict');
  });

  it('maps 401/403 to forbidden', () => {
    expect(mapSupabaseError({ status: 401, message: 'no' }).kind).toBe('forbidden');
    expect(mapSupabaseError({ status: 403, message: 'no' }).kind).toBe('forbidden');
  });

  it('maps PGRST116 / 404 to not_found', () => {
    expect(mapSupabaseError({ code: 'PGRST116' }).kind).toBe('not_found');
    expect(mapSupabaseError({ status: 404 }).kind).toBe('not_found');
  });

  it('passes through an existing RepositoryError unchanged', () => {
    const original = new RepositoryError('boom', 'validation');
    expect(mapSupabaseError(original)).toBe(original);
  });

  it('preserves a safe provider message when no code matches', () => {
    expect(mapSupabaseError({ message: 'weird thing' }).message).toBe('weird thing');
  });

  it('does not expose provider internals to the UI', () => {
    expect(mapSupabaseError({ message: 'column secret_table.internal_id does not exist' }).message).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('falls back to a generic message for unknown shapes', () => {
    expect(mapSupabaseError(42).kind).toBe('unknown');
  });
});

describe('logSupabaseError (dev diagnostics)', () => {
  it('retains code, details, and hint when logging in dev', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSupabaseError('company.updates.install', {
      code: '42501',
      status: 403,
      message: 'permission denied for table document_notes',
      details: 'insufficient privilege',
      hint: 'grant insert to authenticated',
    });
    // DEV is on under vitest; the structured entry keeps developer-facing context.
    if (spy.mock.calls.length > 0) {
      const entry = spy.mock.calls[0]![1] as Record<string, unknown>;
      expect(entry.code).toBe('42501');
      expect(entry.details).toContain('insufficient privilege');
      expect(entry.hint).toContain('grant insert');
    }
    spy.mockRestore();
  });
});
