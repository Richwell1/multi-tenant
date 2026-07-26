export type OptionalWidgetState = 'loading' | 'ready' | 'empty' | 'unavailable';

export interface OptionalWidgetQuery<T> {
  data?: T[];
  isPending: boolean;
  isError: boolean;
}

export function resolveOptionalWidget<T>(
  query: OptionalWidgetQuery<T>,
): { rows: T[]; state: OptionalWidgetState } {
  if (query.isPending) return { rows: [], state: 'loading' };
  if (query.isError) return { rows: [], state: 'unavailable' };
  const rows = query.data ?? [];
  return { rows, state: rows.length ? 'ready' : 'empty' };
}
