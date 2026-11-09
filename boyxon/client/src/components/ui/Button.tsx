import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:scale-[0.95] select-none touch-manipulation disabled:opacity-50',
        size === 'sm' && 'h-9 px-4 text-sm',
        size === 'md' && 'h-12 px-6 text-[15px]',
        size === 'lg' && 'h-[52px] px-8 text-base',
        variant === 'primary' && 'bg-gradient-to-r from-primary-700 to-primary-800 text-white hover:brightness-110',
        variant === 'outline' && 'border border-line-strong bg-transparent text-fg hover:bg-surface-raised hover:border-accent',
        variant === 'ghost' && 'text-fg-muted hover:bg-surface-raised',
        variant === 'danger' && 'bg-danger text-white',
        className,
      )}
      {...rest}
    />
  );
}
