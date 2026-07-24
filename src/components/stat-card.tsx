import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-6">
      <p className="text-label-bold uppercase text-content-variant">{label}</p>
      <p className="mt-2 text-3xl font-bold text-content">{value}</p>
      {hint && <p className="mt-1 text-xs text-content-variant">{hint}</p>}
    </Card>
  );
}
