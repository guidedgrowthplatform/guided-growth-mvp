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
      className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-white px-[17px] py-[7px] shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-xs font-bold tracking-[0.3px] text-primary">Feedback</span>
      <Icon icon="ix:feedback" width={20} height={20} className="text-primary" />
    </button>
  );
}
