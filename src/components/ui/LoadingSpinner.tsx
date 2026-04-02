import { Icon } from '@iconify/react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function LoadingSpinner({
  size = 'md',
  className = '',
  color = 'text-primary',
}: LoadingSpinnerProps) {
  return (
    <Icon
      icon="svg-spinners:ring-resize"
      width={sizeMap[size]}
      className={`${color} ${className}`}
    />
  );
}
