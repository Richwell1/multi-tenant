import { describe, it, expect } from 'vitest';
import { allowedTargetModesForPackageType, allowedTargetModesForExtension } from './package-target';

describe('allowedTargetModesForPackageType', () => {
  it('private customization is restricted to one company', () => {
    expect(allowedTargetModesForPackageType('private_customization')).toEqual(['one_company']);
  });
  it('private extension is restricted to one company', () => {
    expect(allowedTargetModesForPackageType('private_extension')).toEqual(['one_company']);
  });
  it('shared extension permits selected or all companies (never one)', () => {
    const modes = allowedTargetModesForPackageType('shared_extension');
    expect(modes).toEqual(['selected_companies', 'all_companies']);
    expect(modes).not.toContain('one_company');
  });
  it('standard update and bug fix allow all three modes', () => {
    expect(allowedTargetModesForPackageType('standard_update')).toEqual([
      'all_companies',
      'selected_companies',
      'one_company',
    ]);
    expect(allowedTargetModesForPackageType('bug_fix')).toHaveLength(3);
  });
  it('configuration and security updates allow all three modes', () => {
    expect(allowedTargetModesForPackageType('configuration_update')).toHaveLength(3);
    expect(allowedTargetModesForPackageType('security_update')).toHaveLength(3);
  });
});

describe('allowedTargetModesForExtension', () => {
  it('private extension → one company only', () => {
    expect(allowedTargetModesForExtension('private_extension')).toEqual(['one_company']);
  });
  it('shared extension → selected or all', () => {
    expect(allowedTargetModesForExtension('shared_extension')).toEqual(['selected_companies', 'all_companies']);
  });
});
