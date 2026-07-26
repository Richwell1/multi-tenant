import { QueryClient } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/query-keys';

// Logout calls queryClient.clear() (src/lib/session.tsx). This verifies that
// clearing removes the marketplace catalog, the membership/entitlement context,
// and installed marketplace/private feature caches — so a signed-out user never
// retains another session's entitlement data.
describe('logout clears marketplace and private entitlement cache', () => {
  it('queryClient.clear() removes marketplace, context, and feature caches', () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.marketplace.all, [{ code: 'document-notes' }]);
    qc.setQueryData(queryKeys.marketplace.adoption, [{ packageKey: 'document-notes' }]);
    qc.setQueryData(queryKeys.context.company('u1'), {
      enabledPackages: [{ code: 'custom-visitor-register', version: '1.0.0' }],
    });
    qc.setQueryData(queryKeys.documentNotes.list('c1'), [{ id: 'n1' }]);
    qc.setQueryData(queryKeys.visitorRegister.list('c1'), [{ id: 'v1' }]);
    qc.setQueryData(queryKeys.updates.list('c1'), [{ installationId: 'i1' }]);

    expect(qc.getQueryData(queryKeys.marketplace.all)).toBeDefined();
    expect(qc.getQueryData(queryKeys.context.company('u1'))).toBeDefined();
    expect(qc.getQueryData(queryKeys.updates.list('c1'))).toBeDefined();

    qc.clear();

    expect(qc.getQueryData(queryKeys.marketplace.all)).toBeUndefined();
    expect(qc.getQueryData(queryKeys.marketplace.adoption)).toBeUndefined();
    expect(qc.getQueryData(queryKeys.context.company('u1'))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.documentNotes.list('c1'))).toBeUndefined();
    expect(qc.getQueryData(queryKeys.visitorRegister.list('c1'))).toBeUndefined();
    // The pending-update count shares this key — cleared on logout (no tenant leak).
    expect(qc.getQueryData(queryKeys.updates.list('c1'))).toBeUndefined();
  });
});
