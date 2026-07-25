import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-label-caps uppercase text-[var(--portal-color)]">{eyebrow}</p>}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-content sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-content-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}
