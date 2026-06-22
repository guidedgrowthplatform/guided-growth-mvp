import type { LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

interface IconCircleButtonProps {
  icon: LucideIcon;
  active?: boolean;
  variant?: 'success' | 'danger';
  ariaLabel?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function IconCircleButton({
  icon: Icon,
  active = false,
  variant = 'success',
  ariaLabel,
  onClick,
}: IconCircleButtonProps) {
  const activeClass =
    variant === 'danger' ? 'border-danger bg-danger' : 'border-success bg-success';
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
        active ? activeClass : 'border-content-tertiary bg-transparent'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-content-tertiary'}`} />
    </button>
  );
}
