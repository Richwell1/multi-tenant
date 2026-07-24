import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from './button';

interface SubmitButtonProps extends ButtonProps {
  pending?: boolean;
  pendingLabel?: string;
}

/** Submit button that disables and shows an inline spinner while pending. */
export function SubmitButton({
  pending = false,
  pendingLabel,
  children,
  disabled,
  ...rest
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} {...rest}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
