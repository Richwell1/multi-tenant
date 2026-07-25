import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      {accent && <div className="absolute inset-y-0 left-0 w-1 bg-[var(--portal-color)]" aria-hidden="true" />}
      <p className="text-label-bold uppercase text-content-variant">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-content">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-content-variant">{hint}</p>}
    </Card>
  );
}
