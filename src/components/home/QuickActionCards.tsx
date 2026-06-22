import { Icon } from '@iconify/react';

interface ActionCardProps {
  icon: string;
  iconWrapClass: string;
  iconClass: string;
  title: string;
  buttonLabel: string;
  onPress: () => void;
}

function ActionCard({
  icon,
  iconWrapClass,
  iconClass,
  title,
  buttonLabel,
  onPress,
}: ActionCardProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-surface px-4 pb-4 pt-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconWrapClass}`}>
        <Icon icon={icon} width={24} height={24} className={iconClass} />
      </div>
      <span className="text-center text-sm font-semibold text-primary">{title}</span>
      <button
        onClick={onPress}
        className="w-full rounded-full bg-[#eaf1fe] py-2 text-xs font-semibold text-[#1e3a8a]"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface QuickActionCardsProps {
  onCheckInPress: () => void;
  onJournalPress: () => void;
}

export function QuickActionCards({ onCheckInPress, onJournalPress }: QuickActionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ActionCard
        icon="mdi:white-balance-sunny"
        iconWrapClass="bg-primary"
        iconClass="text-white"
        title="How are you feeling?"
        buttonLabel="Morning Check In"
        onPress={onCheckInPress}
      />
      <ActionCard
        icon="fa6-solid:cloud-moon"
        iconWrapClass="bg-[#fdf0cd]"
        iconClass="text-[#1e3a8a]"
        title="Habits & Reflection"
        buttonLabel="Evening Check In"
        onPress={onJournalPress}
      />
    </div>
  );
}
