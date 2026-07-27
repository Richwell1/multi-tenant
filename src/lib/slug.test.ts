import { describe, it, expect } from 'vitest';
import { deriveSlug, isValidSlug } from './slug';

describe('deriveSlug', () => {
  it('lowercases and hyphenates free text', () => {
    expect(deriveSlug('Acme Corp')).toBe('acme-corp');
    expect(deriveSlug('  Rich & Co.  ')).toBe('rich-co');
  });

  it('collapses runs and trims edge hyphens', () => {
    expect(deriveSlug('--Foo   Bar!!--')).toBe('foo-bar');
    expect(deriveSlug('A / B / C')).toBe('a-b-c');
  });

  it('produces the empty string for punctuation-only input', () => {
    expect(deriveSlug('***')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlug('acme-corp')).toBe(true);
    expect(isValidSlug('a1')).toBe(true);
  });

  it('rejects too-short, edge-hyphen, or invalid-character slugs', () => {
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('-acme')).toBe(false);
    expect(isValidSlug('acme-')).toBe(false);
    expect(isValidSlug('Acme')).toBe(false);
    expect(isValidSlug('a b')).toBe(false);
  });
});
