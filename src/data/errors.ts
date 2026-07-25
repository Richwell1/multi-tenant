// ---------------------------------------------------------------------------
// Normalized data-layer errors. Repository adapters (mock today, Supabase next)
// throw RepositoryError so hooks/UI never depend on a provider's error shape.
// ---------------------------------------------------------------------------

export type RepositoryErrorKind =
  | 'conflict' // unique violation (e.g. duplicate slug/subdomain/email)
  | 'not_found'
  | 'forbidden' // RLS / authorization denial
  | 'validation'
  | 'network'
  | 'unknown';

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly kind: RepositoryErrorKind = 'unknown',
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/** Structural shape shared by PostgREST/Auth errors — avoids hard coupling. */
interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
}

function isSupabaseLike(e: unknown): e is SupabaseLikeError {
  return typeof e === 'object' && e !== null && ('message' in e || 'code' in e || 'status' in e);
}

/**
 * Map a Supabase (PostgREST or Auth) error to a normalized RepositoryError.
 * Pure and provider-agnostic so it can be unit-tested and reused by every
 * Supabase adapter.
 */
export function mapSupabaseError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;

  if (isSupabaseLike(error)) {
    const { code, status, message } = error;

    // Postgres error codes surfaced by PostgREST.
    if (code === '23505') return new RepositoryError('That value is already taken.', 'conflict', error);
    if (code === '23503') return new RepositoryError('A related record was not found.', 'validation', error);
    if (code === 'PGRST116') return new RepositoryError('Record not found.', 'not_found', error);

    // Auth / RLS.
    if (status === 401 || status === 403) {
      return new RepositoryError('You are not authorized to perform this action.', 'forbidden', error);
    }
    if (status === 404) return new RepositoryError('Record not found.', 'not_found', error);
    if (status === 409) return new RepositoryError('That value is already taken.', 'conflict', error);

    if (message) return new RepositoryError(message, 'unknown', error);
  }

  return new RepositoryError('An unexpected error occurred. Please try again.', 'unknown', error);
}
