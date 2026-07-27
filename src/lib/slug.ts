// ---------------------------------------------------------------------------
// Company slug helpers. A slug is the subdomain label: lowercase letters,
// numbers and single hyphens, no leading/trailing hyphen. Mirrors the register
// form's zod rule (^[a-z0-9-]+$) so the auto-derived value is always valid.
// ---------------------------------------------------------------------------

/** Derive a valid slug from free-text (e.g. a company name). */
export function deriveSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-'); // collapse runs of hyphens
}

/** Whether a slug matches the accepted format (does not check availability). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2;
}
