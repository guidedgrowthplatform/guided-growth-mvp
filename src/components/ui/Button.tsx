import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-md',
  secondary: 'bg-white/70 text-slate-700 hover:bg-white/90 border border-cyan-200/50',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-md',
  ghost: 'text-slate-600 hover:bg-slate-100/50',
} as const;

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
