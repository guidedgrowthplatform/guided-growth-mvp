import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm',
  secondary: 'bg-surface text-content border border-border hover:bg-surface-secondary',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
  ghost: 'text-content-secondary hover:bg-surface-secondary',
  icon: 'rounded-full bg-primary text-white hover:bg-primary-dark shadow-card',
  'social-dark': 'bg-black text-white hover:bg-gray-900',
  'social-light': 'bg-white text-content border border-border hover:bg-surface-secondary',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-sm',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
  xl: 'px-8 py-4 text-lg rounded-lg',
  auth: 'px-6 h-14 text-base rounded-full',
  'auth-rect': 'px-6 h-14 text-base rounded-[24px]',
} as const;

const spinnerColors: Record<string, string> = {
  primary: 'border-white/30 border-t-white',
  danger: 'border-white/30 border-t-white',
  'social-dark': 'border-white/30 border-t-white',
  icon: 'border-white/30 border-t-white',
};
const defaultSpinnerColor = 'border-primary/30 border-t-primary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <span
            className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${spinnerColors[variant] ?? defaultSpinnerColor}`}
          />
        )}
        {children}
      </span>
    </button>
  );
}
