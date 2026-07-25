import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onCancel();
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-content/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby={description ? 'confirm-description' : undefined}
      onClick={() => !pending && onCancel()}
    >
      <div
        ref={dialogRef}
        className={cn('w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl sm:p-6')}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-content">
          {title}
        </h2>
        {description && <div id="confirm-description" className="mt-2 text-sm leading-6 text-content-variant">{description}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
