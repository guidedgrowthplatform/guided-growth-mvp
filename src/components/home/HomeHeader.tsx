import { Icon } from '@iconify/react';
import { format } from 'date-fns';

interface HomeHeaderProps {
  userName: string;
  isFirstVisit?: boolean;
  onPlusClick?: () => void;
  onBellClick?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function HomeHeader({
  userName,
  isFirstVisit = false,
  onPlusClick,
  onBellClick,
}: HomeHeaderProps) {
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
      <div className="-mr-1 mt-3 flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Add"
          onClick={onPlusClick}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shadow-sm"
        >
          <Icon icon="mdi:plus" width={22} height={22} className="text-white" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          onClick={onBellClick}
          className="flex h-11 w-11 items-center justify-center"
        >
          <Icon icon="mdi:bell" width={24} height={24} className="text-primary" />
        </button>
      </div>
    </div>
  );
}
