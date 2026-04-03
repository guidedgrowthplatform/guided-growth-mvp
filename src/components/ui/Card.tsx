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
      className={`rounded-lg border border-border bg-surface shadow-card ${paddingMap[padding]} ${hoverable ? 'cursor-pointer transition-shadow hover:shadow-card-hover active:shadow-card-hover' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}
