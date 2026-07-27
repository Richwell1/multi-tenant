import { describe, it, expect } from 'vitest';
import { MockRegistrationRepository } from './mock-registration-repository';
import { mapRegistrationError } from './edge-registration-repository';
import { RepositoryError } from '@/data/errors';

describe('MockRegistrationRepository (backend-authoritative slug allocation)', () => {
  const repo = new MockRegistrationRepository();
  const base = { companyName: 'Rich Company', email: 'founder@rich.test', password: 'Str0ngPass1' };

  it('auto-derives a slug from the company name when none is chosen', async () => {
    const res = await repo.register({ ...base });
    expect(res.slug).toBe('rich-company');
    expect(res.subdomain).toBe('rich-company'); // subdomain mirrors the slug
    expect(res.role).toBe('company_admin');
    expect(res.hrCore).toEqual({ packageKey: 'hr-core', version: '1.0.0' });
  });

  it('honors a valid user-chosen slug verbatim (lowercased)', async () => {
    const res = await repo.register({ ...base, slug: 'Rich-HQ' });
    expect(res.slug).toBe('rich-hq');
  });

  it('appends a collision-safe suffix when the auto slug is already taken', async () => {
    // "Acme Ltd" → base "acme-ltd" is a seeded-taken slug in the mock backend.
    const res = await repo.register({ companyName: 'Acme Ltd', email: 'a@acme.test', password: 'Str0ngPass1' });
    expect(res.slug).not.toBe('acme-ltd');
    expect(res.slug).toMatch(/^acme-ltd-[a-z0-9]{4}$/);
  });

  it('rejects a duplicate email and a taken user-chosen slug with a field', async () => {
    await expect(repo.register({ ...base, email: 'taken@x.com' })).rejects.toMatchObject({ kind: 'conflict', field: 'email' });
    await expect(repo.register({ ...base, slug: 'taken' })).rejects.toMatchObject({ kind: 'conflict', field: 'slug' });
  });

  it('rejects a reserved user-chosen slug', async () => {
    await expect(repo.register({ ...base, slug: 'admin' })).rejects.toMatchObject({ kind: 'validation', field: 'slug' });
  });

  it('reports slug availability: reserved/invalid unavailable, others available', async () => {
    await expect(repo.checkSlugAvailability('taken')).resolves.toMatchObject({ available: false, verified: true });
    await expect(repo.checkSlugAvailability('admin')).resolves.toMatchObject({ available: false, verified: true });
    await expect(repo.checkSlugAvailability('ab')).resolves.toMatchObject({ available: false, verified: true }); // too short
    await expect(repo.checkSlugAvailability('rich-co')).resolves.toMatchObject({ available: true, verified: true });
  });
});

describe('mapRegistrationError (Edge → RepositoryError)', () => {
  it('maps duplicate codes to conflict', () => {
    for (const code of ['duplicate_email', 'duplicate_slug', 'duplicate_subdomain', 'conflict']) {
      expect(mapRegistrationError(code, 'x')).toMatchObject({ kind: 'conflict' });
    }
  });
  it('maps reserved/invalid slug to validation on the slug field', () => {
    expect(mapRegistrationError('reserved_slug', 'x')).toMatchObject({ kind: 'validation', field: 'slug' });
    expect(mapRegistrationError('invalid_slug', 'x')).toMatchObject({ kind: 'validation', field: 'slug' });
  });
  it('carries the conflicting field so the UI can surface it inline', () => {
    expect(mapRegistrationError('duplicate_slug', 'x').field).toBe('slug');
    expect(mapRegistrationError('duplicate_subdomain', 'x').field).toBe('subdomain');
    expect(mapRegistrationError('duplicate_email', 'x').field).toBe('email');
  });
  it('maps validation to validation', () => {
    expect(mapRegistrationError('validation', 'bad').kind).toBe('validation');
  });
  it('unknown code → unknown, preserving message', () => {
    const e = mapRegistrationError('onboarding_failed', 'Try again');
    expect(e).toBeInstanceOf(RepositoryError);
    expect(e.kind).toBe('unknown');
    expect(e.message).toBe('Try again');
  });
});
