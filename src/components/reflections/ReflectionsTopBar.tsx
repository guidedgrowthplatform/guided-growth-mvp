import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ReflectionsTopBarProps {
  title: string;
  fallbackPath?: string;
  rightSlot?: ReactNode;
}

export function ReflectionsTopBar({
  title,
  fallbackPath = '/reflections',
  rightSlot,
}: ReflectionsTopBarProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackPath);
  };

  return (
    <div className="relative flex h-14 items-center justify-center">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back"
        className="absolute left-0 flex size-10 items-center justify-center rounded-full text-content hover:bg-surface-secondary"
      >
        <Icon icon="ic:round-arrow-back" width={20} height={20} />
      </button>
      <h1 className="text-base font-semibold text-content">{title}</h1>
      {rightSlot && <div className="absolute right-0">{rightSlot}</div>}
    </div>
  );
}
