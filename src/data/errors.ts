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
    /** Optional form field this error maps to (e.g. a 'conflict' on 'slug'). */
    readonly field?: string,
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

const safeMessage = (message: string | undefined) =>
  (message ?? 'Unknown Supabase error')
    .replace(/eyJ[a-zA-Z0-9._-]+/g, '[redacted-token]')
    .slice(0, 300);

const isProviderInternalMessage = (message: string) =>
  /\b(?:postgres(?:ql)?|postgrest|relation|schema|column .* does not exist|syntax error|violates .* constraint)\b/i.test(
    message,
  );

/**
 * Development-only, structured Supabase diagnostics without credentials.
 * Retains code/status/message AND details/hint so failures like a missing table
 * grant (42501) or a policy denial are fully identifiable in the console — while
 * the user-facing message stays safe (see mapSupabaseError). No-op in production.
 */
export function logSupabaseError(operation: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  const candidate = isSupabaseLike(error) ? error : undefined;
  console.error('[supabase]', {
    operation,
    code: candidate?.code ?? 'UNKNOWN',
    status: candidate?.status ?? null,
    message: safeMessage(candidate?.message ?? (error instanceof Error ? error.message : undefined)),
    details: candidate?.details ? safeMessage(candidate.details) : null,
    hint: candidate?.hint ? safeMessage(candidate.hint) : null,
  });
}

function isSupabaseLike(e: unknown): e is SupabaseLikeError {
  return typeof e === 'object' && e !== null && ('message' in e || 'code' in e || 'status' in e);
}

/**
 * Safe failure categories returned by the lifecycle RPCs, mapped to user-facing
 * copy. Mirrors public.lifecycle_failure_category(); anything unrecognized falls
 * back to the generic message, so a new backend category can never leak raw text.
 */
const LIFECYCLE_FAILURE_MESSAGE: Record<string, { message: string; kind: RepositoryErrorKind }> = {
  not_authorized: { message: 'You are not authorized to perform this action.', kind: 'forbidden' },
  already_installed: { message: 'That package is already installed.', kind: 'validation' },
  not_installed: { message: 'That package is not installed.', kind: 'validation' },
  company_not_active: { message: 'This company is not active.', kind: 'validation' },
  package_inactive: { message: 'That package is no longer active.', kind: 'validation' },
  not_marketplace_package: { message: 'That package cannot be installed from the marketplace.', kind: 'validation' },
  no_installable_version: { message: 'No installable version is available yet.', kind: 'validation' },
  dependency_not_met: { message: 'A required base package is not enabled.', kind: 'validation' },
  base_package_not_enabled: { message: 'A required base package is not enabled.', kind: 'validation' },
  base_version_too_low: { message: 'The base package must be updated first.', kind: 'validation' },
};

/**
 * Lifecycle RPCs (install / update / rollback) report an apply-phase failure by
 * RETURNING `status: 'failed'` with a safe category rather than raising — a
 * failure cannot be logged from inside the transaction it aborts, so the RPC
 * commits the monitoring record and reports the outcome in its payload.
 *
 * Without this guard a failed operation would read as success. Throws the
 * normalized RepositoryError callers already expect; otherwise a no-op.
 */
export function assertLifecycleRpcSucceeded(data: unknown, operation: string): void {
  if (typeof data !== 'object' || data === null) return;
  const payload = data as { status?: unknown; error?: unknown };
  if (payload.status !== 'failed') return;

  const category = typeof payload.error === 'string' ? payload.error : 'operation_failed';
  const mapped = LIFECYCLE_FAILURE_MESSAGE[category];
  logSupabaseError(operation, { code: category, status: 200, message: 'lifecycle operation failed' });
  throw new RepositoryError(
    mapped?.message ?? 'That action could not be completed. Please try again.',
    mapped?.kind ?? 'unknown',
  );
}

/**
 * Map a Supabase (PostgREST or Auth) error to a normalized RepositoryError.
 * Pure and provider-agnostic so it can be unit-tested and reused by every
 * Supabase adapter.
 */
export function mapSupabaseError(error: unknown, operation?: string): RepositoryError {
  if (error instanceof RepositoryError) return error;

  if (operation) logSupabaseError(operation, error);

  if (isSupabaseLike(error)) {
    const { code, status, message } = error;

    // Postgres error codes surfaced by PostgREST.
    if (code === '23505') return new RepositoryError('That value is already taken.', 'conflict', error);
    if (code === '23503') return new RepositoryError('A related record was not found.', 'validation', error);
    if (code === 'PGRST116') return new RepositoryError('Record not found.', 'not_found', error);

    // Auth / RLS.
    if (status === 401 || status === 403 || code === '42501') {
      return new RepositoryError('You are not authorized to perform this action.', 'forbidden', error);
    }
    if (status === 404) return new RepositoryError('Record not found.', 'not_found', error);
    if (status === 409) return new RepositoryError('That value is already taken.', 'conflict', error);

    const userMessage = safeMessage(message);
    if (message && !isProviderInternalMessage(userMessage)) {
      return new RepositoryError(userMessage, 'unknown', error);
    }
  }

  return new RepositoryError('An unexpected error occurred. Please try again.', 'unknown', error);
}
