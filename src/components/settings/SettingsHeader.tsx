import { Icon } from '@iconify/react';

interface Props {
  onBack: () => void;
  onMenu?: () => void;
}

export function SettingsHeader({ onBack, onMenu }: Props) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
      >
        <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
      </button>
      <h1 className="text-xl font-bold text-content">Settings</h1>
      <button
        type="button"
        onClick={onMenu}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
      >
        <Icon icon="mdi:dots-vertical" width={16} className="text-content" />
      </button>
    </div>
  );
}
