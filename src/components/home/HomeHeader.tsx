import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import type { CSSProperties } from 'react';

interface HomeHeaderProps {
  userName: string;
  isFirstVisit?: boolean;
  onPlusClick?: () => void;
  onBellClick?: () => void;
  // The home tour glows + lifts the add button (the plus) above its blur veil.
  highlightPlus?: boolean;
}

// Glow ring + lift above the tour's blur veil (zIndex 60 > the veil's 44). The
// ggGlow keyframe is injected by the tour; outside it this is just a static ring.
const PLUS_HIGHLIGHT: CSSProperties = {
  position: 'relative',
  zIndex: 60,
  outline: '2px solid rgb(19,91,235)',
  outlineOffset: 3,
  boxShadow: '0 0 0 5px rgba(19,91,236,0.12)',
  animation: 'ggGlow 1800ms ease-in-out infinite',
};

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
  highlightPlus = false,
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
      <div className="mt-3 flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Add"
          onClick={onPlusClick}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary shadow-sm"
          style={highlightPlus ? PLUS_HIGHLIGHT : undefined}
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
