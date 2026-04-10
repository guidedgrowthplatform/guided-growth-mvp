import { useVoice } from '@/hooks/useVoice';

interface AIResponseTextProps {
  /** The text from the AI to display */
  text: string;
  /**
   * If true, the text will animate as if it's being spoken/typed.
   * Useful when streaming real-time voice, less useful for pre-recorded.
   */
  isStreaming?: boolean;
}

export function AIResponseText({ text, isStreaming }: AIResponseTextProps) {
  const { preference } = useVoice();

  if (!text) return null;

  // Determine display mode based on user's voice preference
  const displayMode = preference === 'full_voice' ? 'transcript' : 'bubble';

  if (displayMode === 'transcript') {
    return (
      <div
        className={`mt-4 max-w-[280px] self-center text-center text-sm italic text-content-secondary ${isStreaming ? 'animate-pulse' : ''}`}
      >
        {text}
      </div>
    );
  }

  // Bubble mode (text_only or speak_in_text_out)
  return (
    <div className="mt-4 flex w-full justify-start pl-2 pr-12">
      <div
        className={`rounded-2xl rounded-tl-sm bg-surface p-4 shadow-sm ${isStreaming ? 'animate-pulse' : ''}`}
      >
        <p className="text-[15px] leading-relaxed text-content">{text}</p>
      </div>
    </div>
  );
}
