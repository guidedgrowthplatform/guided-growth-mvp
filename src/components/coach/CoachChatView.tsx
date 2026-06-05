import { X } from 'lucide-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { HabitSuggestionCard } from '@/components/voice/HabitSuggestionCard';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicEnabled } from '@/hooks/useMicEnabled';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { useSmoothReveal } from '@/hooks/useSmoothReveal';
import type { CoachChatApi } from '@/lib/chat/coachChatTypes';
import { stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';

interface CoachChatViewProps extends CoachChatApi {
  displayName?: string;
  onClose: () => void;
}

export function CoachChatView({
  messages,
  voiceState,
  speaking,
  startListening,
  stopListening,
  sendText,
  updateHabitDays,
  displayName,
  onClose,
}: CoachChatViewProps) {
  const [draft, setDraft] = useState('');

  const micEnabled = useMicEnabled();
  const { voiceOn, micOn, micAllowed, toggleVoice, toggleMic, requestMicPermission } =
    useDualButtonControls();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const interim = useVoiceStore((s) => s.interim);
  const revealedInterim = useSmoothReveal(interim);

  const isListening = voiceState === 'listening';
  const { intensity: micRingIntensity, speaking: micSpeaking } = useMicVoiceActivity(isListening);
  const dualActiveRings: 'left' | 'right' | 'ready' | null = isListening
    ? micSpeaking
      ? 'right'
      : 'ready'
    : speaking && voiceOn
      ? 'left'
      : null;

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, voiceState]);

  useEffect(() => {
    if (micEnabled && voiceState === 'idle' && !speaking) {
      startListening();
    } else if (!micEnabled && voiceState === 'listening') {
      stopListening();
    }
  }, [micEnabled, voiceState, speaking, startListening, stopListening]);

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
    <div className="fixed inset-0 z-30 flex flex-col" onClick={handleClose}>
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
        className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 pt-14"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <ChatBubble
              role={msg.role}
              text={msg.text}
              userName={displayName}
              compact
              eyebrowVariant="dark"
              markdown
            />
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
        {interim && (
          <ChatBubble
            role="user"
            text={revealedInterim}
            userName={displayName}
            compact
            eyebrowVariant="dark"
            animate={false}
            streaming
          />
        )}
        <div ref={scrollAnchorRef} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <DualButton
          size={91}
          leftActive={voiceOn}
          rightActive={micOn}
          activeRings={dualActiveRings}
          ringCount={3}
          ringStep={4}
          intensity={dualActiveRings === 'right' ? micRingIntensity : undefined}
          leftIcon={voiceOn ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
          rightIcon={micOn ? <IconMic size={26} /> : <IconMicMuted size={26} />}
          onLeftClick={toggleVoice}
          onRightClick={micAllowed ? toggleMic : () => void requestMicPermission()}
          leftAriaLabel={voiceOn ? 'Switch to screen mode' : 'Switch to voice mode'}
          rightAriaLabel={!micAllowed ? 'Allow microphone' : micOn ? 'Turn mic off' : 'Turn mic on'}
        />
        <ChatComposer
          value={draft}
          onValueChange={setDraft}
          onSubmit={(t) => {
            sendText(t);
            setDraft('');
          }}
          disabled={voiceState !== 'idle'}
          className="pointer-events-auto flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
        />
      </div>
    </div>
  );
}
