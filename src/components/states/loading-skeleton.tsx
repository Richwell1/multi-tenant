import { cn } from '@/lib/utils';

/** Generic shimmer block. Compose for any skeleton layout. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-subtle', className)} />;
}

/** Table skeleton — header + N rows of shimmer cells. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex gap-4 bg-surface-subtle px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-t border-border px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <LoadingSkeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
