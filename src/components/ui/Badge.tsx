import type { ReactNode } from 'react';

const variantStyles = {
  default: 'bg-surface-secondary text-content-secondary',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
} as const;

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
} as const;

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
}
