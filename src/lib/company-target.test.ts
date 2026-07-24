import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyIds,
  normalizeCompanyTarget,
  toCompanyTargetPayload,
  companyTargetKeyPart,
  companyMatchesTarget,
  createCompanyTargetSchema,
  companyTargetSchema,
} from './company-target';

describe('normalizeCompanyIds', () => {
  it('dedupes and sorts (stable keys)', () => {
    expect(normalizeCompanyIds(['b', 'a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('normalizeCompanyTarget (mode switching)', () => {
  it('→ all_companies clears company ids', () => {
    expect(normalizeCompanyTarget({ mode: 'selected_companies', companyIds: ['a', 'b'] }, 'all_companies')).toEqual({
      mode: 'all_companies',
      companyIds: [],
    });
  });

  it('→ one_company keeps a single selection but clears an ambiguous one', () => {
    expect(normalizeCompanyTarget({ mode: 'selected_companies', companyIds: ['a'] }, 'one_company')).toEqual({
      mode: 'one_company',
      companyIds: ['a'],
    });
    expect(normalizeCompanyTarget({ mode: 'selected_companies', companyIds: ['a', 'b'] }, 'one_company')).toEqual({
      mode: 'one_company',
      companyIds: [],
    });
  });

  it('→ selected_companies preserves valid selections (deduped)', () => {
    expect(normalizeCompanyTarget({ mode: 'one_company', companyIds: ['b', 'a', 'a'] }, 'selected_companies')).toEqual({
      mode: 'selected_companies',
      companyIds: ['a', 'b'],
    });
  });
});

describe('toCompanyTargetPayload', () => {
  it('all_companies → empty ids', () => {
    expect(toCompanyTargetPayload({ mode: 'all_companies', companyIds: ['x'] })).toEqual({
      target: 'all_companies',
      targetCompanyIds: [],
    });
  });
  it('one_company → the single id', () => {
    expect(toCompanyTargetPayload({ mode: 'one_company', companyIds: ['company-id'] })).toEqual({
      target: 'one_company',
      targetCompanyIds: ['company-id'],
    });
  });
  it('selected_companies → sorted, deduped ids', () => {
    expect(
      toCompanyTargetPayload({ mode: 'selected_companies', companyIds: ['company-id-2', 'company-id-1', 'company-id-2'] }),
    ).toEqual({ target: 'selected_companies', targetCompanyIds: ['company-id-1', 'company-id-2'] });
  });
});

describe('companyTargetKeyPart', () => {
  it('normalizes ids so equivalent selections share a key', () => {
    const a = companyTargetKeyPart({ mode: 'selected_companies', companyIds: ['b', 'a'] });
    const b = companyTargetKeyPart({ mode: 'selected_companies', companyIds: ['a', 'b'] });
    expect(a).toEqual(b);
  });
});

describe('companyMatchesTarget', () => {
  it('all matches everyone; selected matches listed only', () => {
    expect(companyMatchesTarget('beta', { mode: 'all_companies', companyIds: [] })).toBe(true);
    expect(companyMatchesTarget('beta', { mode: 'selected_companies', companyIds: ['alpha'] })).toBe(false);
    expect(companyMatchesTarget('alpha', { mode: 'one_company', companyIds: ['alpha'] })).toBe(true);
  });
});

describe('companyTargetSchema validation', () => {
  it('all_companies must not carry ids', () => {
    expect(companyTargetSchema.safeParse({ mode: 'all_companies', companyIds: ['x'] }).success).toBe(false);
    expect(companyTargetSchema.safeParse({ mode: 'all_companies', companyIds: [] }).success).toBe(true);
  });
  it('one_company requires exactly one', () => {
    expect(companyTargetSchema.safeParse({ mode: 'one_company', companyIds: [] }).success).toBe(false);
    expect(companyTargetSchema.safeParse({ mode: 'one_company', companyIds: ['a'] }).success).toBe(true);
    expect(companyTargetSchema.safeParse({ mode: 'one_company', companyIds: ['a', 'b'] }).success).toBe(false);
  });
  it('selected_companies requires at least two (default)', () => {
    expect(companyTargetSchema.safeParse({ mode: 'selected_companies', companyIds: ['a'] }).success).toBe(false);
    expect(companyTargetSchema.safeParse({ mode: 'selected_companies', companyIds: ['a', 'b'] }).success).toBe(true);
  });
  it('rejects duplicate ids', () => {
    expect(companyTargetSchema.safeParse({ mode: 'selected_companies', companyIds: ['a', 'a'] }).success).toBe(false);
  });
  it('restricts modes via the factory', () => {
    const schema = createCompanyTargetSchema({ allowedModes: ['one_company'] });
    expect(schema.safeParse({ mode: 'all_companies', companyIds: [] }).success).toBe(false);
    expect(schema.safeParse({ mode: 'one_company', companyIds: ['a'] }).success).toBe(true);
  });
});
