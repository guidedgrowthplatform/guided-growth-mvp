import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';

export function InsightsHeader() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-[24px] font-bold leading-8 text-content">Insights</h1>
      <div className="flex gap-4">
        <button
          aria-label="Calendar"
          className="rounded-full bg-surface p-2 shadow-sm"
          onClick={() => navigate('/report/calendar')}
        >
          <Icon icon="mdi:calendar-blank-outline" width={20} height={20} className="text-content" />
        </button>
        <button aria-label="Share" className="rounded-full bg-surface p-2 shadow-sm">
          <Icon icon="mdi:export-variant" width={20} height={20} className="text-content" />
        </button>
      </div>
    </div>
  );
}
