'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', prefix, suffix, error, ...props }, ref) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/10 focus-within:border-cyan-400/80 focus-within:ring-2 focus-within:ring-cyan-400/50">
        {prefix ? <span className="text-slate-400">{prefix}</span> : null}
        <input
          ref={ref}
          type={type}
          className={cn('flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60', className)}
          {...props}
        />
        {suffix ? <span className="text-slate-400">{suffix}</span> : null}
      </div>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  )
);

Input.displayName = 'Input';
