'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', icon: Icon, children, ...props }, ref) => {
    const base =
      'h-12 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
    const styles: Record<ButtonVariant, string> = {
      primary: 'bg-white text-black hover:bg-zinc-200 border border-transparent',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700',
      outline:
        'border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 bg-transparent',
      ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
    };

    return (
      <button ref={ref} className={cn(base, styles[variant], className)} {...props}>
        {Icon && <Icon size={18} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

