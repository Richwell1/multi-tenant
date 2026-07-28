// ---------------------------------------------------------------------------
// Registration error mapping.
//
// The reported bug: a valid slug (`gold-company`) produced "Company slug is
// invalid." That text is the SERVER's, passed straight through. Two independent
// failures combined — an availability check that always 401'd, and a deployed
// function that rejected a MISSING slug with invalid-format wording — and the
// UI reported both as "your slug is malformed".
//
// These tests pin the rule that prevents a recurrence: user-facing copy is
// chosen from the error CODE (a contract), never from server text.
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import { mapRegistrationError } from './edge-registration-repository';
import { isValidSlug, slugIssue } from '@/lib/slug';

describe('slug format rules', () => {
  it('accepts the slug that was wrongly rejected in production', () => {
    expect(isValidSlug('gold-company')).toBe(true);
    expect(slugIssue('gold-company')).toBeFalsy();
  });

  it('accepts other well-formed slugs', () => {
    for (const slug of ['acme', 'acme-co', 'a1b2', 'multi-word-company-name']) {
      expect(isValidSlug(slug)).toBe(true);
    }
  });

  it('rejects malformed slugs', () => {
    for (const slug of [
      'gold company', // space
      'gold_company', // underscore
      '-gold', // leading hyphen
      'gold-', // trailing hyphen
      'Gold-Company', // uppercase
      'ab', // too short
    ]) {
      expect(isValidSlug(slug)).toBe(false);
    }
  });

  it('flags a reserved slug distinctly from a malformed one', () => {
    // Reserved must not be reported as a format error — different fix for the user.
    expect(slugIssue('admin')).toBe('reserved');
    expect(slugIssue('gold company')).not.toBe('reserved');
  });
});

describe('mapRegistrationError — copy comes from the code, not the server', () => {
  it('does NOT surface server text for a known code', () => {
    // The exact production payload that misled the user.
    const error = mapRegistrationError('validation', 'Company slug is invalid.');
    expect(error.message).not.toContain('Company slug is invalid');
    expect(error.message).toBe('Please check the highlighted fields and try again.');
  });

  it('maps a taken slug to actionable copy on the slug field', () => {
    const error = mapRegistrationError('duplicate_slug', 'whatever the server said');
    expect(error.message).toBe('This workspace URL is already taken.');
    expect(error.kind).toBe('conflict');
    expect(error.field).toBe('slug');
  });

  it('maps a reserved slug distinctly from a malformed one', () => {
    expect(mapRegistrationError('reserved_slug', undefined).message).toBe(
      'This workspace URL is reserved. Choose another name.',
    );
    expect(mapRegistrationError('invalid_slug', undefined).message).toBe(
      'Use lowercase letters, numbers, and hyphens only.',
    );
  });

  it('maps a duplicate email to the email field', () => {
    const error = mapRegistrationError('duplicate_email', undefined);
    expect(error.message).toBe('An account already exists for this email.');
    expect(error.field).toBe('email');
  });

  it('maps provisioning failures to a retryable message, not a slug complaint', () => {
    for (const code of ['onboarding_failed', 'server_error']) {
      const error = mapRegistrationError(code, 'internal detail');
      expect(error.message).toBe('Registration is temporarily unavailable. Please try again.');
      expect(error.message).not.toMatch(/slug|workspace URL/i);
      expect(error.field).toBeUndefined();
    }
  });

  it('falls back safely when there is no code at all', () => {
    const error = mapRegistrationError(undefined, undefined);
    expect(error.message).toBe('Registration could not be completed. Please try again.');
    expect(error.field).toBeUndefined();
  });

  it('surfaces server text ONLY for an unrecognized code, so new reasons are not swallowed', () => {
    const error = mapRegistrationError('some_future_code', 'A new backend reason.');
    expect(error.message).toBe('A new backend reason.');
  });

  it('never blames the slug for a subdomain conflict message mismatch', () => {
    // duplicate_subdomain and duplicate_slug are the same user-visible problem.
    expect(mapRegistrationError('duplicate_subdomain', undefined).message).toBe(
      'This workspace URL is already taken.',
    );
  });
});
