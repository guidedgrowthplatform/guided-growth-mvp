import type { ReactNode } from 'react';

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof paddingMap;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', padding = 'md', hoverable, onClick }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-lg shadow-card border border-border ${paddingMap[padding]} ${hoverable ? 'hover:shadow-card-hover transition-shadow cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}
