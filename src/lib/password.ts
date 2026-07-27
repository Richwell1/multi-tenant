// ---------------------------------------------------------------------------
// Lightweight password strength heuristic for the registration form. Advisory
// only — the enforced rule stays the zod min-length (8). No external library.
// ---------------------------------------------------------------------------

export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'strong';

/** Score a password into an advisory strength bucket. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'empty';
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 2) return 'weak';
  if (score === 3) return 'fair';
  return 'strong';
}

export const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};
