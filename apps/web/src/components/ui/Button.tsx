import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white border border-transparent hover:opacity-90',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-3',
};

const SIZES: Record<Size, string> = {
  md: 'h-9 px-4 text-base',
  sm: 'h-[30px] px-3 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'focus-ring inline-flex items-center justify-center gap-2 rounded-control font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    />
  );
}
