import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border/90 bg-surface shadow-[0_1px_2px_rgba(11,28,48,0.04)]', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-subtle/80">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-4 py-3.5 text-left text-label-caps uppercase text-content-variant',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-t border-border/80 transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3.5 text-content', className)}>{children}</td>;
}
