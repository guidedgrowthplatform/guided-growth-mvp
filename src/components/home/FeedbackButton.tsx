import { Icon } from '@iconify/react';
import { speak } from '@/lib/services/tts-service';

interface FeedbackButtonProps {
  onPress: () => void;
}

export function FeedbackButton({ onPress }: FeedbackButtonProps) {
  const handleClick = () => {
    speak("What's working? What's not? Be honest — that's how this gets better.");
    onPress();
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-white px-4 py-2.5 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-sm font-bold tracking-wide text-primary">Feedback</span>
      <Icon icon="mdi:thumb-up" width={16} height={16} className="text-primary" />
    </button>
  );
}
