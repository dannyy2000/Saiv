import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 disabled:bg-cyan-500/60 disabled:text-slate-900',
  secondary:
    'bg-slate-800/80 hover:bg-slate-700/90 text-slate-100 border border-white/10 disabled:bg-slate-800/60',
  ghost:
    'hover:bg-white/10 text-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent',
  outline:
    'border border-slate-700 hover:border-cyan-400/70 hover:text-cyan-200 text-slate-100 disabled:border-slate-800 disabled:text-slate-500',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/30 disabled:bg-rose-600/60',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-current" />
          <span className="text-xs uppercase tracking-wide">Loading</span>
        </span>
      ) : (
        <>
          {leftIcon ? <span className="inline-flex items-center text-base">{leftIcon}</span> : null}
          <span>{children}</span>
          {rightIcon ? <span className="inline-flex items-center text-base">{rightIcon}</span> : null}
        </>
      )}
    </button>
  )
);

Button.displayName = 'Button';
