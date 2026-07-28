import { useState } from 'react';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RepositoryError } from '@/data/errors';
import {
  useChecklistItems,
  useCreateChecklistItem,
  useSetChecklistItemDone,
} from '@/hooks/onboarding-checklist';

/**
 * Custom Onboarding Checklist — a Private Customization that renders INSIDE the
 * HR Core Employees surface for the assigned company (no standalone route). Its
 * data is entitlement-gated + RLS-scoped; this component only calls hooks.
 */
export function OnboardingChecklistCard() {
  const query = useChecklistItems();
  const create = useCreateChecklistItem();
  const setDone = useSetChecklistItemDone();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string>();
  const items = query.data ?? [];
  const completed = items.filter((i) => i.done).length;

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    create.mutate(
      { label },
      {
        onSuccess: () => setLabel(''),
        onError: (err) => setError(err instanceof RepositoryError ? err.message : 'Could not add the item.'),
      },
    );
  };

  return (
    <Card className="mb-6 max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" /> Onboarding Checklist
        </CardTitle>
        {items.length > 0 && (
          <Badge tone={completed === items.length ? 'healthy' : 'neutral'}>
            {completed}/{items.length} done
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}
        {query.isPending ? (
          <p className="text-sm text-content-variant">Loading checklist…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-content-variant">No checklist items yet. Add the first onboarding step below.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  aria-label={item.done ? `Mark "${item.label}" not done` : `Mark "${item.label}" done`}
                  aria-pressed={item.done}
                  onClick={() => setDone.mutate({ id: item.id, done: !item.done })}
                  className="text-[var(--portal-color)]"
                >
                  {item.done ? <CheckCircle2 className="size-4 text-status-healthy" /> : <Circle className="size-4 text-content-variant" />}
                </button>
                <span className={item.done ? 'text-content-variant line-through' : 'text-content'}>{item.label}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex gap-2 pt-1" noValidate>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an onboarding step…" aria-label="New checklist item" />
          <Button type="submit" disabled={create.isPending}>Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}
