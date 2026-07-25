import { describe, expect, it } from 'vitest';
import { createRepository } from './repository';

describe('repository factory', () => {
  it('selects a lazy Supabase adapter without throwing', () => {
    expect(() => createRepository('supabase')).not.toThrow();
  });
});
