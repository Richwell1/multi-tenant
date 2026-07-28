// ---------------------------------------------------------------------------
// Lifecycle Monitoring read path — regression cover for the `/admin/lifecycle`
// production failure (400 PGRST200).
//
// The defect was a PostgREST embed (`packages(name)`) with no declared foreign
// key behind it. The FK itself is asserted in
// supabase/tests/lifecycle_monitoring_grants_rls.sql — a schema fact no unit
// test can prove. What belongs here is the contract around it: the query is not
// tenant-filtered (Platform Admin reads globally, RLS scopes it), it orders by a
// real timestamp column, it maps nullable columns without inventing values, and
// a provider failure surfaces as a safe message while staying fully diagnosable
// in the dev console.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Response = { data: unknown; error: unknown };

const client = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => client }));

import { SupabasePackageLifecycleRepository } from './supabase';
import { RepositoryError } from '@/data/errors';

/** Records the builder calls so the shape of the query itself can be asserted. */
function query(response: Response) {
  const calls = { select: [] as string[], order: [] as unknown[], eq: [] as unknown[], limit: [] as unknown[] };
  const builder = {
    calls,
    select: vi.fn((cols: string) => {
      calls.select.push(cols);
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.order.push(args);
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.eq.push(args);
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      calls.limit.push(args);
      return builder;
    }),
    then: (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return builder;
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'op-1',
  package_key: 'document-notes',
  operation: 'install',
  status: 'completed',
  source_version: null,
  target_version: '1.0.0',
  diagnostics_status: 'PASS',
  correlation_id: 'corr-1',
  failure_reason: null,
  started_at: '2026-07-28T10:00:00.000Z',
  completed_at: '2026-07-28T10:00:05.000Z',
  companies: { name: 'Alpha Trading' },
  packages: { name: 'Document Notes' },
  ...over,
});

describe('SupabasePackageLifecycleRepository.listOperations', () => {
  let builder: ReturnType<typeof query>;

  const configure = (response: Response) => {
    builder = query(response);
    client.from.mockImplementation(() => builder);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the monitoring log without any company filter (RLS scopes the rows)', async () => {
    configure({ data: [row()], error: null });

    await new SupabasePackageLifecycleRepository().listOperations();

    expect(client.from).toHaveBeenCalledWith('package_lifecycle_operations');
    // A tenant filter here would silently hide other companies from Platform
    // Admin; scoping is RLS's job, not the query's.
    expect(builder.calls.eq).toEqual([]);
  });

  it('orders by started_at descending — a real timestamp column on the table', async () => {
    configure({ data: [], error: null });

    await new SupabasePackageLifecycleRepository().listOperations();

    expect(builder.calls.order).toEqual([['started_at', { ascending: false }]]);
  });

  it('only embeds relationships the schema actually declares', async () => {
    configure({ data: [], error: null });

    await new SupabasePackageLifecycleRepository().listOperations();

    const select = builder.calls.select[0];
    // Both embeds require a declared FK from package_lifecycle_operations.
    // `packages(name)` is the one that was missing and returned 400 PGRST200.
    expect(select).toContain('companies(name)');
    expect(select).toContain('packages(name)');
    // Columns must exist on the table as created in 20260802010000.
    for (const col of [
      'id',
      'package_key',
      'operation',
      'status',
      'source_version',
      'target_version',
      'diagnostics_status',
      'correlation_id',
      'failure_reason',
      'started_at',
      'completed_at',
    ]) {
      expect(select).toContain(col);
    }
    // Columns that do NOT exist on this table must never creep into the select.
    expect(select).not.toContain('package_id');
    expect(select).not.toContain('retention_until');
  });

  it('maps a fully populated row to the monitoring record', async () => {
    configure({ data: [row()], error: null });

    const [op] = await new SupabasePackageLifecycleRepository().listOperations();

    expect(op).toEqual({
      id: 'op-1',
      companyName: 'Alpha Trading',
      packageKey: 'document-notes',
      packageName: 'Document Notes',
      operation: 'install',
      status: 'completed',
      sourceVersion: null,
      targetVersion: '1.0.0',
      diagnosticsStatus: 'PASS',
      correlationId: 'corr-1',
      failureReason: null,
      startedAt: '2026-07-28T10:00:00.000Z',
      completedAt: '2026-07-28T10:00:05.000Z',
    });
  });

  it('handles nullable columns and absent embeds without inventing data', async () => {
    configure({
      data: [row({ companies: null, packages: null, diagnostics_status: null, completed_at: null })],
      error: null,
    });

    const [op] = await new SupabasePackageLifecycleRepository().listOperations();

    expect(op.companyName).toBe('—');
    // Falls back to the raw key rather than a fabricated display name.
    expect(op.packageName).toBe('document-notes');
    expect(op.diagnosticsStatus).toBeNull();
    expect(op.completedAt).toBeNull();
  });

  it('returns an empty list (not an error) when the log has no rows', async () => {
    configure({ data: [], error: null });

    await expect(new SupabasePackageLifecycleRepository().listOperations()).resolves.toEqual([]);
  });

  it('treats a null payload as empty rather than throwing', async () => {
    configure({ data: null, error: null });

    await expect(new SupabasePackageLifecycleRepository().listOperations()).resolves.toEqual([]);
  });

  it('surfaces a schema-cache failure as a safe RepositoryError, leaking no database internals', async () => {
    // The verbatim production error.
    configure({
      data: null,
      error: {
        code: 'PGRST200',
        status: 400,
        message:
          "Could not find a relationship between 'package_lifecycle_operations' and 'packages' in the schema cache",
        details:
          "Searched for a foreign key relationship between 'package_lifecycle_operations' and 'packages' in the schema 'public', but no matches were found.",
        hint: "Perhaps you meant 'package_restore_points' instead of 'packages'.",
      },
    });

    const error = await new SupabasePackageLifecycleRepository().listOperations().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    const message = (error as RepositoryError).message;
    expect(message).toBe('An unexpected error occurred. Please try again.');
    for (const leak of ['schema cache', 'foreign key', 'package_lifecycle_operations', 'PGRST200']) {
      expect(message).not.toContain(leak);
    }
  });

  it('logs code, status, message, details and hint to the dev console for diagnosis', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    configure({
      data: null,
      error: { code: '42501', status: 401, message: 'permission denied', details: 'd', hint: 'h' },
    });

    await new SupabasePackageLifecycleRepository().listOperations().catch(() => undefined);

    expect(spy).toHaveBeenCalledWith(
      '[supabase]',
      expect.objectContaining({
        operation: 'package-lifecycle.operations',
        code: '42501',
        status: 401,
        details: 'd',
        hint: 'h',
      }),
    );
    spy.mockRestore();
  });

  it('maps a permission failure to a forbidden RepositoryError', async () => {
    configure({ data: null, error: { code: '42501', status: 401, message: 'permission denied' } });

    const error = (await new SupabasePackageLifecycleRepository()
      .listOperations()
      .catch((e: unknown) => e)) as RepositoryError;

    expect(error.kind).toBe('forbidden');
  });
});
