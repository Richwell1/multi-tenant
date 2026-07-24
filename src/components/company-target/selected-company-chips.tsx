import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CompanyOption {
  id: string;
  name: string;
}

interface SelectedCompanyChipsProps {
  companies: CompanyOption[];
  selectedIds: string[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Pill chips for the currently selected companies, each removable. */
export function SelectedCompanyChips({
  companies,
  selectedIds,
  onRemove,
  disabled,
  className,
}: SelectedCompanyChipsProps) {
  if (selectedIds.length === 0) return null;
  const byId = new Map(companies.map((c) => [c.id, c.name]));
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {selectedIds.map((id) => {
        const name = byId.get(id) ?? id;
        return (
          <li
            key={id}
            className="inline-flex items-center gap-1 rounded-pill bg-[var(--portal-color,#3525cd)]/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-[var(--portal-color,#3525cd)]"
          >
            {name}
            {onRemove && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(id)}
                aria-label={`Remove ${name}`}
                className="rounded-full p-0.5 hover:bg-[var(--portal-color,#3525cd)]/20 disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
