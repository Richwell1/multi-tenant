import { describe, it, expect } from 'vitest';
import { passwordStrength } from './password';

describe('passwordStrength', () => {
  it('reports empty for no input', () => {
    expect(passwordStrength('')).toBe('empty');
  });

  it('reports weak for short or low-variety passwords', () => {
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('abcdefgh')).toBe('weak'); // length only
  });

  it('reports fair for a mix that clears a few criteria', () => {
    expect(passwordStrength('Abcdefg1')).toBe('fair'); // 8+, mixed case, digit
  });

  it('reports strong for long, varied passwords', () => {
    expect(passwordStrength('Abcdefgh1!23')).toBe('strong'); // 12+, mixed, digit, symbol
  });
});
