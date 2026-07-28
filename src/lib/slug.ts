// ---------------------------------------------------------------------------
// Company slug helpers. A slug is the public tenant routing identifier in
// `/:companySlug/...` — lowercase letters, numbers and single hyphens, no
// leading/trailing hyphen, length 3..63, and never a reserved word.
//
// The DATABASE is authoritative for uniqueness and final allocation
// (public.register_company + the companies_slug_* constraints). These helpers
// power client-side UX (preview, format/reserved feedback) and the mock backend;
// they never replace the company UUID + membership + RLS security boundary.
// ---------------------------------------------------------------------------

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 63;

/** Slug format: lowercase alphanumerics separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reserved slugs that must never become a workspace URL. AUTHORITATIVE list —
 * mirrored verbatim by public.is_reserved_slug() in the
 * 20260801010000_unique_company_slugs migration. Keep the two in sync.
 */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'dashboard',
  'settings',
  'support',
  'system',
  'platform',
  'www',
  'home',
  'health',
  'packages',
  'updates',
  'extensions',
  'marketplace',
] as const;

const RESERVED_SET = new Set<string>(RESERVED_SLUGS);

/** Whether a slug is on the reserved list (case-insensitive). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SET.has(slug.trim().toLowerCase());
}

/** Derive a valid base slug from free text (e.g. a company name). */
export function deriveSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-') // collapse runs of hyphens
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, ''); // re-trim if truncation left a trailing hyphen
}

/** Whether a slug matches the accepted format + length (not reserved-aware). */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length >= SLUG_MIN_LENGTH && slug.length <= SLUG_MAX_LENGTH;
}

export type SlugIssue = 'empty' | 'invalid' | 'too-short' | 'too-long' | 'reserved';

/**
 * Classify why a slug is unacceptable, or null when it is well-formed. Format
 * and reserved checks are client-side truth; availability is a separate check.
 */
export function slugIssue(slug: string): SlugIssue | null {
  const s = slug.trim();
  if (s.length === 0) return 'empty';
  if (s.length < SLUG_MIN_LENGTH) return 'too-short';
  if (s.length > SLUG_MAX_LENGTH) return 'too-long';
  if (!SLUG_PATTERN.test(s)) return 'invalid';
  if (isReservedSlug(s)) return 'reserved';
  return null;
}

/** Short, non-sequential, URL-safe suffix for collision resolution. */
export function randomSlugSuffix(length = 4): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Build a slug candidate for a given attempt. Attempt 0 is the bare base; later
 * attempts append a random suffix (never a predictable sequence). The base is
 * clipped so the final value stays within the max length.
 */
export function buildSlugCandidate(base: string, attempt: number, suffix = randomSlugSuffix()): string {
  if (attempt <= 0) return base;
  const clipped = base.slice(0, SLUG_MAX_LENGTH - suffix.length - 1).replace(/-+$/g, '');
  return `${clipped}-${suffix}`;
}
