import { X } from 'lucide-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { IconChatText, IconChatVoice, IconMic } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import {
  useOnboardingVoice,
  type OnboardingStepContext,
  type OnboardingVoiceResult,
} from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, stopTTS, unlockTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

interface OnboardingChatOverlayProps {
  stepContext: OnboardingStepContext;
  onAction: (result: OnboardingVoiceResult) => void;
  onClose: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  ttsEnabled?: boolean;
  onToggleTts?: () => void;
}

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const LISTENING_GRADIENT =
  'linear-gradient(to top, rgba(253,208,23,0.7) 5%, rgba(255,255,255,0.001) 68%, rgba(255,255,255,0.7) 88%, rgba(246,246,246,0.7) 100%)';

export function OnboardingChatOverlay({
  stepContext,
  onAction,
  onClose,
  onContinue,
  continueDisabled,
  continueLabel = 'Continue',
  messages,
  setMessages,
  ttsEnabled = true,
  onToggleTts,
}: OnboardingChatOverlayProps) {
  const { user } = useAuth();
  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || undefined;
  const { isListening, transcript, interim, toggle, error, resetTranscript } = useVoiceInput();
  const { processTranscript } = useOnboardingVoice();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const [wantToListen, setWantToListen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastErrorRef = useRef('');
  const processedTranscriptRef = useRef('');

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!error || error === lastErrorRef.current) return;
    lastErrorRef.current = error;
    setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'ai', text: error }]);
  }, [error, setMessages]);

  const voiceState = isProcessing ? 'processing' : isListening ? 'listening' : 'idle';

  const handleClose = useCallback(() => {
    if (isListening) toggle();
    resetTranscript();
    onClose();
  }, [isListening, toggle, onClose, resetTranscript]);

  const handleMicPress = useCallback(() => {
    unlockTTS();
    stopTTS();
    processedTranscriptRef.current = '';
    setWantToListen((v) => !v);
  }, []);

  useEffect(() => {
    if (wantToListen && !isListening && !isProcessing && !isSpeaking) {
      const timer = setTimeout(() => {
        if (wantToListen && !isListening && !isProcessing && !isSpeaking) {
          unlockTTS();
          toggle();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    if (!wantToListen && isListening) {
      toggle();
    }
  }, [wantToListen, isListening, isProcessing, isSpeaking, toggle]);

  useEffect(() => {
    if (
      !isListening &&
      transcript &&
      !isProcessing &&
      transcript !== processedTranscriptRef.current
    ) {
      processedTranscriptRef.current = transcript;

      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: transcript }]);
      setIsProcessing(true);

      resetTranscript();

      processTranscript(transcript, stepContext)
        .then((result) => {
          setMessages((prev) => [
            ...prev,
            { id: `assistant-${Date.now()}`, role: 'ai', text: result.message },
          ]);

          if (ttsEnabled) speak(result.message);

          if (result.success) onAction(result);
          setIsProcessing(false);
        })
        .catch(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'ai',
              text: 'Sorry, something went wrong. Please try again.',
            },
          ]);
          setIsProcessing(false);
        });
    }
  }, [
    isListening,
    transcript,
    isProcessing,
    stepContext,
    processTranscript,
    onAction,
    resetTranscript,
    setMessages,
    ttsEnabled,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const scrollTop = e.currentTarget.scrollTop;
    if (deltaY > 100 && scrollTop <= 0) handleClose();
    touchStartY.current = null;
  };

  const gradient = voiceState === 'listening' ? LISTENING_GRADIENT : IDLE_GRADIENT;
  const activeRings = voiceState === 'listening' ? 'right' : isSpeaking ? 'left' : null;

  return (
    <div className="fixed inset-0 z-50 flex animate-slide-up flex-col">
      <div className="absolute inset-0 bg-white" />
      <div
        className="absolute inset-0 backdrop-blur-[50px]"
        style={{ backgroundImage: gradient, transition: 'background-image 300ms ease-out' }}
      />

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close chat"
        className="absolute right-6 z-30 flex items-center gap-1.5 text-[10px] font-bold leading-[12px] text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span>Close chat</span>
        <X className="h-6 w-6" />
      </button>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pt-[64px]"
        style={{
          paddingBottom: 'calc(400px + max(48px, env(safe-area-inset-bottom)))',
          maskImage:
            'linear-gradient(to top, transparent 0px, transparent 220px, black 440px, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, transparent 0px, transparent 220px, black 440px, black 100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <ChatBubble
              role={msg.role}
              text={msg.text}
              userName={displayName}
              eyebrowVariant="dark"
            />
          </div>
        ))}
        {voiceState === 'processing' && <TypingIndicator />}
        {interim && (
          <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-content-secondary">
            {interim}
          </p>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto">
          <DualButton
            size={91}
            leftActive={ttsEnabled}
            rightActive={wantToListen}
            activeRings={activeRings}
            ringCount={3}
            ringStep={4}
            leftIcon={ttsEnabled ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
            rightIcon={<IconMic size={26} />}
            onLeftClick={onToggleTts}
            onRightClick={handleMicPress}
            leftAriaLabel={ttsEnabled ? 'Mute coach voice' : 'Unmute coach voice'}
            rightAriaLabel={wantToListen ? 'Turn mic off' : 'Turn mic on'}
          />
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          className="pointer-events-auto flex h-[56px] w-full items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] transition-opacity disabled:opacity-50"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
