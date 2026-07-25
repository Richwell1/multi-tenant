import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content shadow-sm transition-colors',
        'placeholder:text-content-variant/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-color,#3525cd)] focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger',
        '[&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
