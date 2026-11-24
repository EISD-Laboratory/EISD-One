import type { HTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'secondary' | 'purple' | 'warning';
}

const badgeStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-brand-gradient text-white shadow-sm',
  success: 'bg-emerald-50/80 text-emerald-700 border border-emerald-200/80 backdrop-blur-sm',
  purple: 'bg-violet-50/80 text-violet-700 border border-violet-200/80 backdrop-blur-sm',
  warning: 'bg-amber-50/80 text-amber-700 border border-amber-200/80 backdrop-blur-sm',
  danger: 'bg-rose-50/80 text-rose-700 border border-rose-200/80 backdrop-blur-sm',
  secondary: 'bg-white/70 text-slate-700 border border-white/80 backdrop-blur-sm shadow-sm',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight',
        badgeStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass-panel rounded-2xl text-slate-900', className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-[15px] font-semibold tracking-tight text-slate-900', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}
