import { describe, it, expect } from 'vitest';
import { actionLabel, actionCategory } from './audit-labels';

describe('actionLabel', () => {
  it('maps known action codes to human labels', () => {
    expect(actionLabel('marketplace.installed')).toBe('Marketplace extension installed');
    expect(actionLabel('diagnostic.created')).toBe('Diagnostic report created');
    expect(actionLabel('release.published')).toBe('Package release published');
    expect(actionLabel('installation.installed')).toBe('Package installed');
  });

  it('prettifies unknown codes rather than leaking raw enum syntax', () => {
    const label = actionLabel('something.new_event');
    expect(label).toBe('Something new event');
    expect(label).not.toMatch(/[._]/);
  });

  it('never returns a code containing a dot or underscore for the known set', () => {
    for (const code of [
      'company.registered', 'package.created', 'package_version.created',
      'update.installed', 'request.status_changed', 'attendance.checked_in',
    ]) {
      expect(actionLabel(code)).not.toMatch(/[._]/);
    }
  });

  it('handles empty input safely', () => {
    expect(actionLabel('')).toBe('—');
  });

  it('exposes the coarse category prefix', () => {
    expect(actionCategory('marketplace.installed')).toBe('marketplace');
  });
});
