import { Icon } from '@iconify/react';
import type { CSSProperties } from 'react';

interface ActionCardProps {
  icon: string;
  iconWrapClass: string;
  iconClass: string;
  title: string;
  buttonLabel: string;
  onPress: () => void;
  highlighted?: boolean;
}

// The home tour glows one card while the coach points it out. A static ring so
// it reads in a screenshot, plus the shared ggGlow pulse when that keyframe is
// present (it is, the tour injects it). Outside the tour this prop is unset and
// the card renders exactly as before.
const HIGHLIGHT_STYLE: CSSProperties = {
  outline: '2px solid rgb(19,91,235)',
  outlineOffset: 4,
  boxShadow: '0 0 0 6px rgba(19,91,236,0.10)',
  animation: 'ggGlow 1800ms ease-in-out infinite',
};

function ActionCard({
  icon,
  iconWrapClass,
  iconClass,
  title,
  buttonLabel,
  onPress,
  highlighted = false,
}: ActionCardProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border border-primary bg-surface px-4 pb-4 pt-5 shadow-sm"
      style={highlighted ? HIGHLIGHT_STYLE : undefined}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconWrapClass}`}>
        <Icon icon={icon} width={24} height={24} className={iconClass} />
      </div>
      <span className="text-center text-sm font-semibold text-primary">{title}</span>
      <button
        onClick={onPress}
        className="w-full rounded-full bg-[#eaf1fe] py-2 text-xs font-semibold text-content"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface QuickActionCardsProps {
  onCheckInPress: () => void;
  onJournalPress: () => void;
  // The home tour passes this to glow one card. Unset everywhere else.
  highlight?: 'checkin' | 'journal';
}

export function QuickActionCards({
  onCheckInPress,
  onJournalPress,
  highlight,
}: QuickActionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ActionCard
        icon="mdi:white-balance-sunny"
        iconWrapClass="bg-primary"
        iconClass="text-white"
        title="How are you feeling?"
        buttonLabel="Morning Check In"
        onPress={onCheckInPress}
        highlighted={highlight === 'checkin'}
      />
      <ActionCard
        icon="fa6-solid:cloud-moon"
        iconWrapClass="bg-[#fdf0cd]"
        iconClass="text-[#1e3a8a]"
        title="Daily Reflection"
        buttonLabel="Evening Reflection"
        onPress={onJournalPress}
        highlighted={highlight === 'journal'}
      />
    </div>
  );
}
