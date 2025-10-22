import type { ReactElement } from 'react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export function Card({ className, ...props }: CardProps): ReactElement {
  return <div className={cn('card-border rounded-2xl bg-slate-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-shadow duration-200 hover:shadow-cyan-500/10', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): ReactElement {
  return <h3 className={cn('text-lg font-semibold text-slate-50', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): ReactElement {
  return <p className={cn('text-sm text-slate-400', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('space-y-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('mt-6 flex items-center justify-between', className)} {...props} />;
}
