import { describe, it, expect } from 'vitest';
import { resolveLoginPortalContext } from './portal-context';
import { companies } from '@/data/mock';

const alpha = companies.find((c) => c.id === 'alpha');
const beta = companies.find((c) => c.id === 'beta');

describe('resolveLoginPortalContext', () => {
  it('platform admin context hides registration', () => {
    const ctx = resolveLoginPortalContext('admin', undefined, null);
    expect(ctx.type).toBe('platform_admin');
    expect(ctx.showRegistration).toBe(false);
    if (ctx.type === 'platform_admin') expect(ctx.name).toBe('Platform Administration');
  });

  it('Alpha company context shows registration with company name', () => {
    const ctx = resolveLoginPortalContext('company', alpha, 'alpha');
    expect(ctx.type).toBe('company');
    expect(ctx.showRegistration).toBe(true);
    if (ctx.type === 'company') {
      expect(ctx.companyName).toBe('Alpha Trading');
      expect(ctx.tenantSlug).toBe('alpha-trading');
    }
  });

  it('Beta company context shows registration', () => {
    const ctx = resolveLoginPortalContext('company', beta, 'beta');
    expect(ctx.type).toBe('company');
    expect(ctx.showRegistration).toBe(true);
    if (ctx.type === 'company') expect(ctx.companyName).toBe('Beta Manufacturing');
  });
});
