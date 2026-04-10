import { Icon } from '@iconify/react';

interface VoiceAiBannerProps {
  onDismiss: () => void;
}

export function VoiceAiBanner({ onDismiss }: VoiceAiBannerProps) {
  return (
    <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <button
        className="absolute right-3 top-3 rounded-full p-1 text-content-secondary hover:bg-primary/10"
        onClick={onDismiss}
      >
        <Icon icon="mdi:close" className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon icon="mdi:microphone" className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-content">
            Tap the mic below to quickly edit your habits.
          </p>
          <p className="mt-1 text-xs text-content-secondary">
            (e.g., &quot;Pause my Afternoon Walk for this week&quot;)
          </p>
        </div>
      </div>
    </div>
  );
}
