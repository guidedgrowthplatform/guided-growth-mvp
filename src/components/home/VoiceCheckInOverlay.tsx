import { X } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface VoiceCheckInOverlayProps {
  onClose: () => void;
}

const NAV_RESERVE = 'calc(72px + env(safe-area-inset-bottom))';

export function VoiceCheckInOverlay({ onClose }: VoiceCheckInOverlayProps) {
  const { user } = useAuth();
  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || undefined;
  const { messages, voiceState, startListening, stopListening, updateHabitDays } =
    useVoiceChat(displayName);

  const micEnabled = useVoiceSettingsStore((s) => s.micEnabled);
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, voiceState]);

  useEffect(() => {
    if (micEnabled && voiceState === 'idle') {
      startListening();
    } else if (!micEnabled && voiceState === 'listening') {
      stopListening();
    }
  }, [micEnabled, voiceState, startListening, stopListening]);

  const handleClose = useCallback(() => {
    stopListening();
    stopTTS();
    onClose();
  }, [stopListening, onClose]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const scrollTop = e.currentTarget.scrollTop;
    if (deltaY > 100 && scrollTop <= 0) handleClose();
    touchStartY.current = null;
  };

  const gradientStyle: React.CSSProperties = {
    backgroundImage: isSpeaking
      ? 'linear-gradient(to bottom, rgba(97,111,137,0.55), rgba(97,111,137,0.65), rgba(97,111,137,0.75), rgba(19,91,236,0.9))'
      : micEnabled
        ? 'linear-gradient(to bottom, rgba(246,246,246,0.45), rgba(81,81,81,0.55), rgba(167,144,52,0.75), rgba(253,208,23,0.9))'
        : 'linear-gradient(to bottom, rgba(148,163,184,0.2), rgba(203,213,225,0.15), rgba(241,245,249,0.1))',
    transition: 'background-image 300ms ease-out',
  };

  return (
    <div
      className="fixed left-0 right-0 top-0 z-30 flex flex-col"
      style={{ bottom: NAV_RESERVE }}
      onClick={handleClose}
    >
      <div className="absolute inset-0 backdrop-blur-[100px]" style={gradientStyle} />

      <button
        onClick={handleClose}
        className="absolute right-4 z-20 flex items-center gap-1 text-[14px] font-medium text-white/90 transition-colors hover:text-white"
        style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        aria-label="Close chat"
      >
        <span>Close chat</span>
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 pt-24"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <ChatBubble role={msg.role} text={msg.text} userName={displayName} />
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
    </div>
  );
}
