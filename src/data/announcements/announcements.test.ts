import { describe, it, expect } from 'vitest';
import { createAnnouncementsRepository } from './index';
import { announcementsService } from '@/services/announcements-service';
import { RepositoryError } from '@/data/errors';

describe('MockAnnouncementsRepository', () => {
  it('creates and lists company-scoped announcements newest-first', async () => {
    const repo = createAnnouncementsRepository('mock');
    await repo.create('alpha', { title: 'First' });
    await repo.create('alpha', { title: 'Second', body: 'Body' });
    const list = await repo.list('alpha');
    expect(list.map((a) => a.title)).toEqual(['Second', 'First']);
    // Another company sees nothing (isolation in the mock store).
    expect(await repo.list('beta')).toEqual([]);
  });
});

describe('announcementsService validation', () => {
  it('rejects an empty title with a safe RepositoryError', () => {
    expect(() => announcementsService.create('alpha', { title: '' })).toThrow(RepositoryError);
  });
  it('accepts a valid announcement', async () => {
    const a = await announcementsService.create('alpha', { title: 'Hello', body: 'World' });
    expect(a).toMatchObject({ title: 'Hello', body: 'World', companyId: 'alpha' });
  });
});
