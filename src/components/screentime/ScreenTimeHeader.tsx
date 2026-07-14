import { Icon } from '@iconify/react';

interface ScreenTimeHeaderProps {
  title: string;
  onBack: () => void;
  onMenu?: () => void;
}

export function ScreenTimeHeader({ title, onBack, onMenu }: ScreenTimeHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-[0px_1px_3px_rgba(0,0,0,0.08)]"
      >
        <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
      </button>
      <h1 className="text-xl font-bold text-content">{title}</h1>
      {onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Manage apps"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-[0px_1px_3px_rgba(0,0,0,0.08)]"
        >
          <Icon icon="mdi:dots-vertical" width={16} className="text-content" />
        </button>
      ) : (
        <div className="h-10 w-10" />
      )}
    </div>
  );
}
