import { Loader2 } from 'lucide-react';
import { LoadingSkeleton } from './loading-skeleton';

export function PageLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-content-variant">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-24" />
        ))}
      </div>
      <LoadingSkeleton className="h-64" />
    </div>
  );
}
