import { Icon } from '@iconify/react';

interface ActionCardProps {
  icon: string;
  title: string;
  buttonLabel: string;
  onPress: () => void;
  variant?: 'default' | 'tinted';
}

function ActionCard({ icon, title, buttonLabel, onPress, variant = 'default' }: ActionCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-border-light px-4 pb-4 pt-5 shadow-sm ${
        variant === 'tinted' ? 'bg-gradient-to-br from-[#f0f5ff] to-[#dbeafe]' : 'bg-surface'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dbeafe]">
        <Icon icon={icon} width={24} height={24} className="text-primary" />
      </div>
      <span className={`text-sm font-semibold ${variant === 'tinted' ? 'text-primary' : 'text-content'}`}>{title}</span>
      <button
        onClick={onPress}
        className="w-full rounded-full bg-primary py-2 text-xs font-semibold text-white shadow-sm"
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
        icon="mdi:emoticon-happy-outline"
        title="How are you feeling?"
        buttonLabel="Check In"
        onPress={onCheckInPress}
      />
      <ActionCard
        icon="mdi:microphone-message"
        title="Daily Reflection"
        buttonLabel="Open Journal"
        onPress={onJournalPress}
        variant="tinted"
      />
    </div>
  );
}
