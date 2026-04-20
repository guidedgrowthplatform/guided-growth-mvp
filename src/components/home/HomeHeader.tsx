import { Icon } from '@iconify/react';
import { format } from 'date-fns';

interface HomeHeaderProps {
  userName: string;
  isFirstVisit?: boolean;
  onPlusClick?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function HomeHeader({ userName, isFirstVisit = false, onPlusClick }: HomeHeaderProps) {
  const headline = isFirstVisit ? 'Welcome to Guided Growth' : `Welcome back, ${userName}`;

  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-normal text-content">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </span>
        <h1 className="text-[28px] font-semibold leading-tight text-content">{headline}</h1>
        {!isFirstVisit && (
          <span className="text-sm font-medium text-content-secondary">{getGreeting()} ☀️</span>
        )}
      </div>
      <button
        aria-label="Add"
        onClick={onPlusClick}
        className="mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm"
      >
        <Icon icon="mdi:plus" width={22} height={22} className="text-white" />
      </button>
    </div>
  );
}
