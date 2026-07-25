import { describe, it, expect } from 'vitest';
import { mapSupabaseError, RepositoryError } from './errors';

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

  it('preserves a provider message when no code matches', () => {
    expect(mapSupabaseError({ message: 'weird thing' }).message).toBe('weird thing');
  });

  it('falls back to a generic message for unknown shapes', () => {
    expect(mapSupabaseError(42).kind).toBe('unknown');
  });
});
