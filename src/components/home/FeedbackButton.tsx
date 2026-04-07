import { MessageSquare } from 'lucide-react';
import { speak } from '@/lib/services/tts-service';

export function FeedbackButton() {
  const handleClick = () => {
    // TTS per Voice Journey Spreadsheet v3 (line 580)
    speak("What's working? What's not? Be honest \u2014 that's how this gets better.");
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface px-4 py-2 shadow-md transition-shadow hover:shadow-lg active:shadow-lg"
    >
      <MessageSquare className="h-4 w-4 text-primary" />
      <span className="text-xs font-bold tracking-wide text-primary">Give Feedback</span>
    </button>
  );
}
