import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }): ReactElement {
  return <div className={cn('animate-pulse rounded-lg bg-slate-800/60', className)} />;
}
