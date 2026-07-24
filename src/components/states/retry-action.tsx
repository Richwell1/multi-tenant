import { RotateCw } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface RetryActionProps extends Omit<ButtonProps, 'onClick'> {
  onRetry: () => void;
  pending?: boolean;
  label?: string;
}

export function RetryAction({ onRetry, pending, label = 'Retry', variant = 'secondary', ...rest }: RetryActionProps) {
  return (
    <Button variant={variant} onClick={onRetry} disabled={pending} {...rest}>
      <RotateCw className={pending ? 'animate-spin' : undefined} />
      {pending ? 'Retrying…' : label}
    </Button>
  );
}
