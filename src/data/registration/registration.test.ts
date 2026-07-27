import { describe, it, expect } from 'vitest';
import { MockRegistrationRepository } from './mock-registration-repository';
import { mapRegistrationError } from './edge-registration-repository';
import { RepositoryError } from '@/data/errors';

describe('MockRegistrationRepository', () => {
  const repo = new MockRegistrationRepository();
  const base = { companyName: 'Acme', slug: 'acme', email: 'founder@acme.test', password: 'Str0ngPass1' };

  it('registers successfully and returns tenant + HR Core', async () => {
    const res = await repo.register({ ...base });
    expect(res.slug).toBe('acme');
    expect(res.subdomain).toBe('acme');
    expect(res.role).toBe('company_admin');
    expect(res.hrCore).toEqual({ packageKey: 'hr-core', version: '1.0.0' });
  });

  it('uses requestedSubdomain when provided', async () => {
    const res = await repo.register({ ...base, requestedSubdomain: 'acme-hq' });
    expect(res.subdomain).toBe('acme-hq');
  });

  it('maps duplicate email / slug / subdomain to distinct conflicts with a field', async () => {
    await expect(repo.register({ ...base, email: 'taken@x.com' })).rejects.toMatchObject({ kind: 'conflict', field: 'email' });
    await expect(repo.register({ ...base, slug: 'taken' })).rejects.toMatchObject({ kind: 'conflict', field: 'slug' });
    await expect(repo.register({ ...base, requestedSubdomain: 'taken' })).rejects.toMatchObject({ kind: 'conflict', field: 'subdomain' });
  });

  it('reports slug availability: reserved slugs are unavailable, others are available', async () => {
    await expect(repo.checkSlugAvailability('taken')).resolves.toMatchObject({ available: false, verified: true });
    await expect(repo.checkSlugAvailability('www')).resolves.toMatchObject({ available: false, verified: true });
    await expect(repo.checkSlugAvailability('rich-co')).resolves.toMatchObject({ available: true, verified: true });
  });
});

describe('mapRegistrationError (Edge → RepositoryError)', () => {
  it('maps duplicate codes to conflict', () => {
    for (const code of ['duplicate_email', 'duplicate_slug', 'duplicate_subdomain', 'conflict']) {
      expect(mapRegistrationError(code, 'x')).toMatchObject({ kind: 'conflict' });
    }
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
