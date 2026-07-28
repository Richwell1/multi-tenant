import { describe, it, expect } from 'vitest';
import { createPulseSurveysRepository } from './index';
import { pulseSurveysService } from '@/services/pulse-surveys-service';
import { RepositoryError } from '@/data/errors';

describe('MockPulseSurveysRepository', () => {
  it('creates and lists company-scoped surveys newest-first', async () => {
    const repo = createPulseSurveysRepository('mock');
    await repo.create('alpha', { question: 'Q1' });
    await repo.create('alpha', { question: 'Q2', description: 'More' });
    const list = await repo.list('alpha');
    expect(list.map((s) => s.question)).toEqual(['Q2', 'Q1']);
    expect(list[0]).toMatchObject({ status: 'active' });
    expect(await repo.list('beta')).toEqual([]);
  });
});

describe('pulseSurveysService validation', () => {
  it('rejects an empty question with a safe RepositoryError', () => {
    expect(() => pulseSurveysService.create('alpha', { question: '' })).toThrow(RepositoryError);
  });
  it('accepts a valid survey', async () => {
    const s = await pulseSurveysService.create('alpha', { question: 'How are you?' });
    expect(s).toMatchObject({ question: 'How are you?', companyId: 'alpha', status: 'active' });
  });
});
