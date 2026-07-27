import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { TableSkeleton, ErrorState, EmptyState, NoResultsState } from '@/components/states';

export interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  data?: T[];
  refetch: () => void;
}

interface TableBoundaryProps<T> {
  query: QueryLike<T>;
  /** Rows after applying the search filter. */
  filtered: T[];
  searchTerm?: string;
  cols?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Optional primary action rendered inside the empty state (e.g. "Add …"). */
  emptyAction?: ReactNode;
  children: ReactNode;
}

/**
 * Maps a TanStack Query result to the correct table state:
 *   isPending -> skeleton, isError -> inline ErrorState + retry,
 *   no data -> EmptyState, filtered-empty -> NoResultsState, else -> table.
 */
export function TableBoundary<T>({
  query,
  filtered,
  searchTerm,
  cols = 4,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: TableBoundaryProps<T>) {
  if (query.isPending) return <TableSkeleton cols={cols} />;

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn’t load records"
        description="The request failed. This is often temporary — retry to try again."
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const total = query.data?.length ?? 0;
  if (total === 0) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  if (filtered.length === 0) return <NoResultsState query={searchTerm} />;

  return <>{children}</>;
}

/** Subtle "refreshing" chip driven by isFetching (background refresh). */
export function RefreshingIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-content-variant">
      <Loader2 className="size-3 animate-spin" /> Refreshing…
    </span>
  );
}
