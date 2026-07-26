import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  /** Optional leading icon (e.g. <Package className="size-5" />), portal-tinted. */
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--portal-color)]/10 text-[var(--portal-color)]"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-label-caps uppercase text-[var(--portal-color)]">{eyebrow}</p>}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-content sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-content-variant">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
