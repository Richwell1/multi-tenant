import { cloneElement, isValidElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const describedBy = [hint && !error ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ');
  const control =
    isValidElement(children) && describedBy
      ? cloneElement(children, {
          'aria-describedby': describedBy,
        } as Record<string, unknown>)
      : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-content">
        {label}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs leading-5 text-content-variant">{hint}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
