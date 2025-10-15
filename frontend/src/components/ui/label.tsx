'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  hint?: string;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, children, hint, ...props }, ref) => (
  <label ref={ref} className={cn('flex flex-col gap-1 text-sm font-medium text-slate-200', className)} {...props}>
    <span>{children}</span>
    {hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
  </label>
));

Label.displayName = 'Label';
