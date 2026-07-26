import { describe, expect, it } from 'vitest';
import { resolveOptionalWidget } from './admin-dashboard';

describe('admin dashboard optional widgets', () => {
  it('keeps the dashboard usable when an optional query fails', () => {
    expect(resolveOptionalWidget({ data: undefined, isPending: false, isError: true })).toEqual({
      rows: [],
      state: 'unavailable',
    });
  });

  it('maps successful data and empty results independently', () => {
    expect(resolveOptionalWidget({ data: [{ label: 'API' }], isPending: false, isError: false })).toEqual({
      rows: [{ label: 'API' }],
      state: 'ready',
    });
    expect(resolveOptionalWidget({ data: [], isPending: false, isError: false })).toEqual({
      rows: [],
      state: 'empty',
    });
  });
});
