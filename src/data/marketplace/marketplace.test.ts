import { describe, it, expect } from 'vitest';
import { createMarketplaceRepository } from './index';
import { createDocumentNotesRepository } from '@/data/document-notes';
import { createExpenseRequestsRepository } from '@/data/expense-requests';
import { availableFeatures } from '@/lib/packages/manifest';
import type { EnabledPackage } from '@/data/context/types';

describe('marketplace (mock)', () => {
  const repo = createMarketplaceRepository('mock');
  it('lists the reusable marketplace extensions', async () => {
    const list = await repo.list();
    expect(list.map((p) => p.code).sort()).toEqual([
      'asset-register',
      'company-announcements',
      'document-notes',
      'expense-requests',
      'pulse-surveys',
    ]);
  });
  it('install returns the installed version', async () => {
    const r = await repo.install('document-notes');
    expect(r.packageKey).toBe('document-notes');
    expect(r.version).toBe('1.0.0');
  });
});

describe('marketplace feature manifest', () => {
  const withNotes = (v: string): EnabledPackage[] => [{ code: 'document-notes', version: v }];
  it('Document Notes 1.0.0 exposes notes only; 1.1.0 adds categories', () => {
    expect(availableFeatures(withNotes('1.0.0'), 'document-notes').map((f) => f.label)).toEqual(['Document Notes']);
    expect(availableFeatures(withNotes('1.1.0'), 'document-notes').map((f) => f.label)).toEqual(['Document Notes', 'Note categories']);
  });
});

describe('document notes + expense requests (mock persistence)', () => {
  it('creates and lists a note for a company', async () => {
    const repo = createDocumentNotesRepository('mock');
    await repo.create('c1', { title: 'Hello' });
    const list = await repo.list('c1');
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('Hello');
    expect(await repo.list('other')).toHaveLength(0);
  });
  it('creates and lists an expense request', async () => {
    const repo = createExpenseRequestsRepository('mock');
    await repo.create('c1', { amount: 12.5, description: 'x' });
    const list = await repo.list('c1');
    expect(list[0]!.amount).toBe(12.5);
    expect(list[0]!.status).toBe('submitted');
  });
});
