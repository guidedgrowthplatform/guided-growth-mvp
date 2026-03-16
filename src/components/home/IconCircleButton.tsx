import type { LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

interface IconCircleButtonProps {
  icon: LucideIcon;
  active?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function IconCircleButton({ icon: Icon, active = false, onClick }: IconCircleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
        active ? 'border-success bg-success' : 'border-content-tertiary bg-transparent'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-content-tertiary'}`} />
    </button>
  );
}
