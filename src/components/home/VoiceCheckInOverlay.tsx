import { Icon } from '@iconify/react';
import { Mic, X } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { unlockTTS } from '@/lib/services/tts-service';

interface VoiceCheckInOverlayProps {
  onClose: () => void;
}

const stateLabel: Record<string, string> = {
  idle: 'Tap to speak',
  listening: 'Listening',
  processing: 'Thinking...',
};

export function VoiceCheckInOverlay({ onClose }: VoiceCheckInOverlayProps) {
  const { messages, voiceState, startListening, stopListening, updateHabitDays } = useVoiceChat();

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Bug 1 fix: Don't reset chat history on close — messages persist in sessionStorage.
  // Stop any active listening but keep the conversation intact.
  const handleClose = useCallback(() => {
    stopListening();
    onClose();
  }, [stopListening, onClose]);

  const handleMicPress = () => {
    unlockTTS();
    if (voiceState === 'listening') {
      stopListening();
    } else if (voiceState === 'idle') {
      startListening();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 100) handleClose();
    touchStartY.current = null;
  };

  const pillBg = voiceState === 'listening' ? 'bg-[#fdd017]' : 'bg-primary';
  const pillText = voiceState === 'listening' ? 'text-content' : 'text-white';
  const showSpinner = voiceState !== 'idle';

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={handleClose}>
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(4,4,4,0.55)] via-[rgba(26,26,26,0.4)] to-[rgba(81,81,81,0.25)]" />
      <div
        className="absolute inset-0 backdrop-blur-[15px]"
        style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, black 40%)' }}
      />

      <button
        onClick={handleClose}
        className="absolute right-5 top-14 z-20 text-white transition-colors hover:text-white/80"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pb-4 pt-24"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatBubble role={msg.role} text={msg.text} />
            {msg.habitCards?.map((card, i) => (
              <HabitSuggestionCard
                key={i}
                name={card.name}
                days={card.days}
                onDaysChange={(days) => updateHabitDays(msg.id, i, days)}
              />
            ))}
          </div>
        ))}
        {voiceState === 'processing' && <TypingIndicator />}
        <div ref={scrollAnchorRef} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {voiceState !== 'idle' && (
          <div className={`mb-4 flex items-center gap-2 rounded-[10px] px-3 py-1.5 ${pillBg}`}>
            <span className={`text-[14px] font-medium ${pillText}`}>{stateLabel[voiceState]}</span>
            {showSpinner && (
              <Icon icon="mingcute:loading-2-line" className={`h-6 w-6 animate-spin ${pillText}`} />
            )}
          </div>
        )}

        <div className="relative flex items-center justify-center">
          <div
            className={`absolute h-[120px] w-[120px] rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_0px_rgba(65,105,225,0.2)] transition-all duration-500 ${
              voiceState === 'listening' ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : ''
            }`}
          />
          <div
            className={`absolute h-[105px] w-[105px] rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_0px_rgba(65,105,225,0.2)] transition-all duration-500 ${
              voiceState === 'listening' ? 'animate-[pulse_1.5s_ease-in-out_infinite_0.3s]' : ''
            }`}
          />
          <button
            onClick={handleMicPress}
            disabled={voiceState === 'processing'}
            className="relative flex h-[75px] w-[75px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)] active:scale-95 disabled:active:scale-100"
          >
            <Mic className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
