import { Icon } from '@iconify/react';

interface VoiceInputBarProps {
  onKeyboardToggle?: () => void;
  onNext?: () => void;
}

export function VoiceInputBar({ onKeyboardToggle, onNext }: VoiceInputBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <button
        type="button"
        aria-label="Toggle keyboard"
        onClick={onKeyboardToggle}
        className="flex h-12 w-12 items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary"
      >
        <Icon icon="mdi:keyboard-outline" width={24} height={24} />
      </button>

      <button
        type="button"
        aria-label="Record voice"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-[0px_0px_15px_rgba(19,91,236,0.3)] transition-transform hover:scale-105 active:scale-95"
      >
        <Icon icon="mdi:microphone" width={32} height={32} />
      </button>

      <button
        type="button"
        aria-label="Next question"
        onClick={onNext}
        className="flex h-12 w-12 items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary"
      >
        <Icon icon="mdi:chevron-right" width={24} height={24} />
      </button>
    </div>
  );
}
