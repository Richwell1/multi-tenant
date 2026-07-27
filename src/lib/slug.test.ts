import { describe, it, expect } from 'vitest';
import {
  deriveSlug,
  isValidSlug,
  isReservedSlug,
  slugIssue,
  buildSlugCandidate,
  randomSlugSuffix,
  RESERVED_SLUGS,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
} from './slug';

describe('deriveSlug', () => {
  it('lowercases and hyphenates free text', () => {
    expect(deriveSlug('Acme Corp')).toBe('acme-corp');
    expect(deriveSlug('Rich Company Limited')).toBe('rich-company-limited');
    expect(deriveSlug('  Rich & Co.  ')).toBe('rich-co');
  });

  it('collapses runs and trims edge hyphens', () => {
    expect(deriveSlug('--Foo   Bar!!--')).toBe('foo-bar');
    expect(deriveSlug('A / B / C')).toBe('a-b-c');
  });

  it('produces the empty string for punctuation-only input', () => {
    expect(deriveSlug('***')).toBe('');
  });

  it('never exceeds the max length and never ends in a hyphen', () => {
    const long = deriveSlug('x'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    const truncated = deriveSlug('a'.repeat(62) + ' b');
    expect(truncated.endsWith('-')).toBe(false);
  });
});

describe('isValidSlug', () => {
  it('accepts well-formed slugs at or above the minimum length', () => {
    expect(isValidSlug('acme-corp')).toBe(true);
    expect(isValidSlug('ab1')).toBe(true);
  });

  it('rejects too-short, too-long, edge-hyphen, or invalid-character slugs', () => {
    expect(isValidSlug('ab')).toBe(false); // below min (3)
    expect(isValidSlug('a'.repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
    expect(isValidSlug('-acme')).toBe(false);
    expect(isValidSlug('acme-')).toBe(false);
    expect(isValidSlug('Acme')).toBe(false);
    expect(isValidSlug('a b')).toBe(false);
    expect(isValidSlug('a_b')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('flags every reserved word (case-insensitively)', () => {
    for (const word of RESERVED_SLUGS) {
      expect(isReservedSlug(word)).toBe(true);
      expect(isReservedSlug(word.toUpperCase())).toBe(true);
    }
  });
  it('does not flag ordinary slugs', () => {
    expect(isReservedSlug('rich-company')).toBe(false);
    expect(isReservedSlug('admin-team')).toBe(false); // only exact 'admin' is reserved
  });
});

describe('slugIssue', () => {
  it('classifies each failure mode and returns null when acceptable', () => {
    expect(slugIssue('')).toBe('empty');
    expect(slugIssue('ab')).toBe('too-short');
    expect(slugIssue('a'.repeat(SLUG_MAX_LENGTH + 1))).toBe('too-long');
    expect(slugIssue('Bad Slug')).toBe('invalid');
    expect(slugIssue('-lead')).toBe('invalid');
    expect(slugIssue('admin')).toBe('reserved');
    expect(slugIssue('rich-company')).toBeNull();
  });
});

describe('slug generation helpers', () => {
  it('randomSlugSuffix is lowercase alphanumeric of the requested length', () => {
    const s = randomSlugSuffix(4);
    expect(s).toMatch(/^[a-z0-9]{4}$/);
  });

  it('buildSlugCandidate returns the base on attempt 0 and a suffixed value after', () => {
    expect(buildSlugCandidate('rich-company', 0)).toBe('rich-company');
    const c = buildSlugCandidate('rich-company', 1, 'k7p2');
    expect(c).toBe('rich-company-k7p2');
    // Never a predictable sequence like rich-company-2.
    expect(c).not.toMatch(/-\d+$/);
  });

  it('clips a long base so the suffixed candidate stays within max length', () => {
    const c = buildSlugCandidate('a'.repeat(63), 1, 'k7p2');
    expect(c.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(isValidSlug(c)).toBe(true);
  });

  it('exposes minimum length of 3', () => {
    expect(SLUG_MIN_LENGTH).toBe(3);
  });
});
