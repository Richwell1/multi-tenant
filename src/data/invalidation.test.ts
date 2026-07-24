import { describe, it, expect } from 'vitest';
import { invalidationTargets } from './invalidation';

const flat = (keys: readonly unknown[]) => JSON.stringify(keys);

describe('scoped invalidation targets', () => {
  it('createEmployee touches only the current company (Alpha, not Beta)', () => {
    const keys = invalidationTargets.createEmployee('alpha');
    expect(flat(keys)).toContain('alpha');
    expect(flat(keys)).not.toContain('beta');
    // includes the employee list prefix + cross-cutting usage/audit
    expect(keys).toContainEqual(['employees', 'alpha']);
    expect(keys).toContainEqual(['usage']);
    expect(keys).toContainEqual(['audit']);
  });

  it('createEmployee for Beta does not touch Alpha', () => {
    const keys = invalidationTargets.createEmployee('beta');
    expect(flat(keys)).toContain('beta');
    expect(flat(keys)).not.toContain('alpha');
  });

  it('assignPackageToCompany scopes to the affected company + global monitoring only', () => {
    const keys = invalidationTargets.assignPackageToCompany('alpha');
    expect(keys).toContainEqual(['packages', 'company', 'alpha']);
    expect(keys).toContainEqual(['companies', 'detail', 'alpha']);
    expect(keys).toContainEqual(['installations']);
    expect(keys).toContainEqual(['packages']);
    // never the other tenant
    expect(flat(keys)).not.toContain('beta');
  });

  it('releaseStandardPackage invalidates global package + install + adoption keys', () => {
    const keys = invalidationTargets.releaseStandardPackage();
    expect(keys).toContainEqual(['packages']);
    expect(keys).toContainEqual(['installations']);
    expect(keys).toContainEqual(['usage']);
  });

  it('never returns an empty/global catch-all', () => {
    for (const build of Object.values(invalidationTargets)) {
      const fn = build as unknown as (...a: string[]) => readonly unknown[][];
      const keys = fn('alpha', 'e1');
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((k) => Array.isArray(k) && k.length > 0)).toBe(true);
    }
  });
});
