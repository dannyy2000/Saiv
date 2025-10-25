import type { ReactElement } from 'react';
import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline';

const variantMap: Record<BadgeVariant, string> = {
  default: 'bg-slate-800/80 text-slate-100 border border-slate-700/80',
  success: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
  warning: 'bg-amber-500/20 text-amber-100 border border-amber-400/40',
  danger: 'bg-rose-500/15 text-rose-100 border border-rose-500/40',
  outline: 'border border-slate-700 text-slate-300 bg-transparent',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps): ReactElement {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide', variantMap[variant], className)} {...props} />;
}
