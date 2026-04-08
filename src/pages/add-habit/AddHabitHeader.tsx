import { Icon } from '@iconify/react';

interface AddHabitHeaderProps {
  onBack: () => void;
}

export function AddHabitHeader({ onBack }: AddHabitHeaderProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
    >
      <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
    </button>
  );
}
