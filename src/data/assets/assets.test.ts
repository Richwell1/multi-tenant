import { describe, it, expect } from 'vitest';
import { createAssetsRepository } from './index';
import { assetsService } from '@/services/assets-service';
import { RepositoryError } from '@/data/errors';

describe('MockAssetsRepository', () => {
  it('creates and lists company-scoped assets newest-first', async () => {
    const repo = createAssetsRepository('mock');
    await repo.create('alpha', { name: 'Monitor' });
    await repo.create('alpha', { name: 'Laptop', assignedTo: 'Rich' });
    const list = await repo.list('alpha');
    expect(list.map((a) => a.name)).toEqual(['Laptop', 'Monitor']);
    // Assigning derives the 'assigned' status.
    expect(list[0]).toMatchObject({ assignedTo: 'Rich', status: 'assigned' });
    expect(list[1]).toMatchObject({ status: 'available' });
    expect(await repo.list('beta')).toEqual([]);
  });
});

describe('assetsService validation', () => {
  it('rejects an empty name with a safe RepositoryError', () => {
    expect(() => assetsService.create('alpha', { name: '' })).toThrow(RepositoryError);
  });
  it('accepts a valid asset', async () => {
    const a = await assetsService.create('alpha', { name: 'Phone', assetTag: 'PH-1' });
    expect(a).toMatchObject({ name: 'Phone', assetTag: 'PH-1', companyId: 'alpha' });
  });
});
