import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  /** Optional portal-tinted icon shown top-right (e.g. <Building2 className="size-5" />). */
  icon?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      {accent && <div className="absolute inset-y-0 left-0 w-1 bg-[var(--portal-color)]" aria-hidden="true" />}
      <div className="flex items-start justify-between gap-3">
        <p className="text-label-bold uppercase text-content-variant">{label}</p>
        {icon && (
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--portal-color)]/10 text-[var(--portal-color)]"
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-content">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-content-variant">{hint}</p>}
    </Card>
  );
}
