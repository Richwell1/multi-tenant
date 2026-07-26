import { describe, it, expect } from 'vitest';
import { parseSemverCore, compareSemver, semverGte } from './semver';

describe('semver', () => {
  it('parses the numeric core', () => {
    expect(parseSemverCore('1.1.0')).toEqual([1, 1, 0]);
    expect(parseSemverCore('2.0.3-beta.1')).toEqual([2, 0, 3]);
    expect(parseSemverCore('bad')).toEqual([0, 0, 0]);
  });

  it('compares by major.minor.patch', () => {
    expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
    expect(compareSemver('1.1.0', '1.1.0')).toBe(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
  });

  it('semverGte handles the gate and null versions', () => {
    expect(semverGte('1.1.0', '1.1.0')).toBe(true);
    expect(semverGte('1.2.0', '1.1.0')).toBe(true);
    expect(semverGte('1.0.0', '1.1.0')).toBe(false);
    expect(semverGte(null, '1.0.0')).toBe(false);
    expect(semverGte(undefined, '1.0.0')).toBe(false);
  });
});
