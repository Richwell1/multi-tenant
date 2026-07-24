import { useId } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSkeleton, ErrorState, EmptyState } from '@/components/states';
import { useActiveCompanies, useCompanies } from '@/hooks/queries';
import {
  ALL_TARGET_MODES,
  TARGET_MODE_LABEL,
  normalizeCompanyTarget,
  type CompanyTargetMode,
  type CompanyTargetValue,
} from '@/lib/company-target';
import { CompanySingleSelect } from './company-single-select';
import { CompanyMultiSelect } from './company-multi-select';
import type { CompanyOption } from './selected-company-chips';

export interface CompanyTargetSelectorProps {
  value: CompanyTargetValue;
  onChange: (value: CompanyTargetValue) => void;
  allowedModes?: CompanyTargetMode[];
  disabled?: boolean;
  activeCompaniesOnly?: boolean;
  minimumSelectedCompanies?: number;
  label?: string;
  description?: string;
  error?: string;
}

/**
 * The single reusable company-targeting control used everywhere the app needs
 * all/selected/one company selection. Business rules restrict the offered modes
 * via `allowedModes`; the control never hard-codes tenant logic.
 */
export function CompanyTargetSelector({
  value,
  onChange,
  allowedModes = ALL_TARGET_MODES,
  disabled = false,
  activeCompaniesOnly = true,
  minimumSelectedCompanies = 2,
  label,
  description,
  error,
}: CompanyTargetSelectorProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  // One centralized company source (cached, shared across every consumer).
  const active = useActiveCompanies();
  const all = useCompanies();
  const query = activeCompaniesOnly ? active : all;
  const companies: CompanyOption[] = (query.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  const setMode = (mode: CompanyTargetMode) => onChange(normalizeCompanyTarget(value, mode));
  const setIds = (companyIds: string[]) => onChange({ ...value, companyIds });

  const needsList = value.mode !== 'all_companies';

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={fieldId} className="block text-label-bold uppercase text-content-variant">
          {label}
        </label>
      )}
      {description && <p className="text-xs text-content-variant">{description}</p>}

      {allowedModes.length > 1 && (
        <div role="radiogroup" aria-label="Target mode" className="inline-flex rounded-md border border-border p-0.5">
          {allowedModes.map((mode) => {
            const activeMode = value.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={activeMode}
                disabled={disabled}
                onClick={() => setMode(mode)}
                className={cn(
                  'rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                  activeMode
                    ? 'bg-[var(--portal-color,#3525cd)] text-white'
                    : 'text-content-variant hover:text-content',
                )}
              >
                {TARGET_MODE_LABEL[mode]}
              </button>
            );
          })}
        </div>
      )}

      {needsList && query.isPending && <LoadingSkeleton className="h-10 w-full" />}
      {needsList && query.isError && (
        <ErrorState
          title="Couldn’t load companies"
          description="The company list failed to load."
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {needsList && !query.isPending && !query.isError && companies.length === 0 && (
        <EmptyState title="No companies" description="There are no companies to target yet." />
      )}

      {needsList && !query.isPending && !query.isError && companies.length > 0 && (
        <>
          {value.mode === 'one_company' && (
            <CompanySingleSelect
              id={fieldId}
              companies={companies}
              selectedIds={value.companyIds}
              onChange={setIds}
              disabled={disabled}
              ariaInvalid={!!error}
              ariaDescribedBy={error ? errorId : undefined}
              ariaLabel={label ?? 'Select a company'}
            />
          )}
          {value.mode === 'selected_companies' && (
            <CompanyMultiSelect
              id={fieldId}
              companies={companies}
              selectedIds={value.companyIds}
              onChange={setIds}
              disabled={disabled}
              ariaInvalid={!!error}
              ariaDescribedBy={error ? errorId : undefined}
              ariaLabel={label ?? 'Select companies'}
            />
          )}
          {value.mode === 'selected_companies' && !error && (
            <p className="text-xs text-content-variant">
              Select at least {minimumSelectedCompanies} companies.
            </p>
          )}
        </>
      )}

      {value.mode === 'all_companies' && (
        <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-content-variant">
          This will apply to <span className="font-medium text-content">all active companies</span>.
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
