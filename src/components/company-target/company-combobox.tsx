import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePopover } from './use-popover';
import { SelectedCompanyChips, type CompanyOption } from './selected-company-chips';

export interface CompanyComboboxProps {
  companies: CompanyOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  placeholder?: string;
}

/**
 * Shared, accessible company combobox. `multi` toggles checkbox multi-select
 * (with chips, select-all-visible, clear-all) vs. single-select. Selections are
 * kept as a de-duplicated id array and are preserved while searching.
 */
export function CompanyCombobox({
  companies,
  selectedIds,
  onChange,
  multi = false,
  disabled = false,
  id,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
  placeholder,
}: CompanyComboboxProps) {
  const reactId = useId();
  const baseId = id ?? reactId;
  const listboxId = `${baseId}-listbox`;
  const { open, setOpen, close, triggerRef, panelRef } = usePopover();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => companies.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [companies, query],
  );

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (companyId: string) => {
    if (multi) {
      const next = new Set(selectedSet);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      onChange([...next]);
    } else {
      onChange([companyId]);
      close();
    }
  };

  const selectAllVisible = () => onChange([...new Set([...selectedIds, ...filtered.map((c) => c.id)])]);
  const clearAll = () => onChange([]);

  const triggerLabel = () => {
    if (multi) {
      const n = selectedIds.length;
      return n ? `${n} compan${n === 1 ? 'y' : 'ies'}` : (placeholder ?? 'Select companies');
    }
    const only = companies.find((c) => c.id === selectedIds[0]);
    return only?.name ?? (placeholder ?? 'Select a company');
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(filtered.length - 1);
        break;
      case 'Enter': {
        e.preventDefault();
        const opt = filtered[activeIndex];
        if (opt) toggle(opt.id);
        break;
      }
    }
  };

  return (
    <div className="space-y-2">
      {multi && (
        <SelectedCompanyChips
          companies={companies}
          selectedIds={selectedIds}
          onRemove={(cid) => onChange(selectedIds.filter((x) => x !== cid))}
          disabled={disabled}
        />
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={baseId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-color,#3525cd)] focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            ariaInvalid && 'border-danger focus-visible:ring-danger',
            selectedIds.length ? 'text-content' : 'text-content-variant',
          )}
        >
          <span className="truncate">{triggerLabel()}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-content-variant" />
        </button>

        {open && (
          <div
            ref={panelRef}
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="size-4 shrink-0 text-content-variant" />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={filtered[activeIndex] ? `${baseId}-opt-${activeIndex}` : undefined}
                aria-label="Search companies"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search companies…"
                className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-content-variant/60"
              />
            </div>

            <ul id={listboxId} role="listbox" aria-multiselectable={multi} className="max-h-60 overflow-y-auto py-1">
              {companies.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-content-variant">No companies available</li>
              ) : filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-content-variant">No matching companies</li>
              ) : (
                filtered.map((c, index) => {
                  const selected = selectedSet.has(c.id);
                  return (
                    <li
                      key={c.id}
                      id={`${baseId}-opt-${index}`}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                        index === activeIndex ? 'bg-surface-subtle' : '',
                      )}
                    >
                      {multi && (
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 items-center justify-center rounded border',
                            selected
                              ? 'border-[var(--portal-color,#3525cd)] bg-[var(--portal-color,#3525cd)] text-white'
                              : 'border-border',
                          )}
                        >
                          {selected && <Check className="size-3" />}
                        </span>
                      )}
                      <span className="flex-1 truncate text-content">{c.name}</span>
                      {!multi && selected && <Check className="size-4 text-[var(--portal-color,#3525cd)]" />}
                    </li>
                  );
                })
              )}
            </ul>

            {multi && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="font-medium text-[var(--portal-color,#3525cd)] hover:underline"
                >
                  Select all visible
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="font-medium text-content-variant hover:text-content hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {multi && (
        <p aria-live="polite" className="text-xs text-content-variant">
          {selectedIds.length} selected
        </p>
      )}
    </div>
  );
}
