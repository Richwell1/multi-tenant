import type { ReactNode } from 'react';
import {
  Inbox,
  SearchX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Ban,
  PackageX,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RetryAction } from './retry-action';

interface StateShellProps {
  icon: ReactNode;
  title: string;
  description?: string;
  tone?: 'neutral' | 'danger' | 'success' | 'suspended';
  action?: ReactNode;
  className?: string;
}

const toneColor = {
  neutral: 'text-content-variant',
  danger: 'text-danger',
  success: 'text-status-healthy',
  suspended: 'text-status-suspended',
} as const;

/** Shared inline state panel used by all message-style states. */
export function StateShell({ icon, title, description, tone = 'neutral', action, className }: StateShellProps) {
  return (
    <Card
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
      role={tone === 'danger' || tone === 'suspended' ? 'alert' : 'status'}
    >
      <div className={cn('mb-3', toneColor[tone])}>{icon}</div>
      <p className="text-base font-semibold text-content">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-content-variant">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Records will appear here once created.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return <StateShell icon={<Inbox className="size-10" />} title={title} description={description} action={action} />;
}

export function NoResultsState({ query }: { query?: string }) {
  return (
    <StateShell
      icon={<SearchX className="size-10" />}
      title="No matching results"
      description={query ? `No records match “${query}”. Try a different search.` : 'Try a different search.'}
    />
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this data. This is often temporary.',
  onRetry,
  retrying,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <StateShell
      icon={<AlertTriangle className="size-10" />}
      title={title}
      description={description}
      tone="danger"
      action={onRetry ? <RetryAction onRetry={onRetry} pending={retrying} /> : undefined}
    />
  );
}

export function SuccessState({
  title = 'Success',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateShell icon={<CheckCircle2 className="size-10" />} title={title} description={description} tone="success" action={action} />
  );
}

export function FailedState({
  title = 'Action failed',
  description = 'The operation did not complete.',
  onRetry,
  retrying,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <StateShell
      icon={<XCircle className="size-10" />}
      title={title}
      description={description}
      tone="danger"
      action={onRetry ? <RetryAction onRetry={onRetry} pending={retrying} label="Try again" /> : undefined}
    />
  );
}

export function AccessDeniedState({
  description = 'You do not have permission to view this resource.',
}: {
  description?: string;
}) {
  return (
    <StateShell
      icon={<ShieldAlert className="size-10" />}
      title="Access Denied"
      description={description}
      tone="danger"
    />
  );
}

export function CompanySuspendedState() {
  return (
    <StateShell
      icon={<Ban className="size-10" />}
      title="Company Suspended"
      description="This workspace has been suspended by the Platform Super Admin."
      tone="suspended"
    />
  );
}

export function PackageUnavailableState({ packageName = 'This package' }: { packageName?: string }) {
  return (
    <StateShell
      icon={<PackageX className="size-10" />}
      title="Package not enabled"
      description={`${packageName} is not enabled for this company. Contact the Platform Super Admin to request access.`}
      tone="danger"
    />
  );
}
