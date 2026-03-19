import { Icon } from '@iconify/react';

interface CalendarHeaderProps {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarHeader({ month, onPrev, onNext }: CalendarHeaderProps) {
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onPrev}
        aria-label="Previous month"
        className="rounded-2xl p-2 active:bg-gray-100"
      >
        <Icon icon="mdi:chevron-left" width={24} height={24} className="text-content" />
      </button>
      <h2 className="text-[20px] font-bold text-content">{label}</h2>
      <button
        onClick={onNext}
        aria-label="Next month"
        className="rounded-2xl p-2 active:bg-gray-100"
      >
        <Icon icon="mdi:chevron-right" width={24} height={24} className="text-content" />
      </button>
    </div>
  );
}
