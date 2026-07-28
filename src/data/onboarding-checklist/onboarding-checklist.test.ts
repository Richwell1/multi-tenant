import { describe, it, expect } from 'vitest';
import { createOnboardingChecklistRepository } from './index';
import { onboardingChecklistService } from '@/services/onboarding-checklist-service';
import { RepositoryError } from '@/data/errors';

describe('MockOnboardingChecklistRepository', () => {
  it('creates, lists (oldest-first), and toggles done', async () => {
    const repo = createOnboardingChecklistRepository('mock');
    const a = await repo.create('alpha', { label: 'Sign contract' });
    await repo.create('alpha', { label: 'Set up laptop' });
    let list = await repo.list('alpha');
    expect(list.map((i) => i.label)).toEqual(['Sign contract', 'Set up laptop']);
    expect(list.every((i) => !i.done)).toBe(true);

    await repo.setDone('alpha', a.id, true);
    list = await repo.list('alpha');
    expect(list.find((i) => i.id === a.id)?.done).toBe(true);

    expect(await repo.list('beta')).toEqual([]);
  });
});

describe('onboardingChecklistService validation', () => {
  it('rejects an empty label with a safe RepositoryError', () => {
    expect(() => onboardingChecklistService.create('alpha', { label: '' })).toThrow(RepositoryError);
  });
});
