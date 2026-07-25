import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-label-caps uppercase',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-subtle text-content-variant',
        healthy: 'bg-status-healthy/10 text-status-healthy',
        degraded: 'bg-status-degraded/10 text-status-degraded',
        offline: 'bg-status-offline/10 text-status-offline',
        suspended: 'bg-status-suspended/10 text-status-suspended',
        platform: 'bg-platform/10 text-platform',
        company: 'bg-company/10 text-company',
        danger: 'bg-danger/10 text-danger',
        warning: 'bg-status-degraded/15 text-[#9A6700]',
        installed: 'bg-status-healthy/10 text-status-healthy',
        pending: 'bg-status-degraded/15 text-[#9A6700]',
        private: 'bg-platform/10 text-platform',
        shared: 'bg-company/10 text-company',
        standard: 'bg-surface-subtle text-content-variant',
        role: 'bg-content/10 text-content',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
