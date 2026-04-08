import { Icon } from '@iconify/react';
import { Mic, X } from 'lucide-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import {
  useOnboardingVoice,
  type OnboardingStepContext,
  type OnboardingVoiceResult,
} from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { unlockTTS, speak, stopTTS } from '@/lib/services/tts-service';

export interface VoiceMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

interface OnboardingVoiceOverlayProps {
  stepContext: OnboardingStepContext;
  onAction: (result: OnboardingVoiceResult) => void;
  onClose: () => void;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
}

// Message type is now exported as VoiceMessage above

const stateLabel: Record<string, string> = {
  idle: 'Tap to speak',
  preparing: 'Preparing mic...',
  listening: 'Listening',
  processing: 'Thinking...',
};

export function OnboardingVoiceOverlay({
  stepContext,
  onAction,
  onClose,
  messages,
  setMessages,
}: OnboardingVoiceOverlayProps) {
  const { user } = useAuth();
  const { isListening, isPreparing, transcript, toggle, error, resetTranscript } = useVoiceInput();
  const { processTranscript } = useOnboardingVoice();
  const [isProcessing, setIsProcessing] = useState(false);
  const lastErrorRef = useRef('');
  // Track which transcript was already sent for processing to prevent re-fires
  const processedTranscriptRef = useRef('');

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Show voice errors as AI messages
  useEffect(() => {
    if (!error || error === lastErrorRef.current) return;
    lastErrorRef.current = error;
    setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'ai', text: error }]);
  }, [error, setMessages]);

  // Determine the voice state — preparing wins over listening so the user
  // sees a loading spinner during the getUserMedia/AudioContext setup window
  // (200–500ms on Android) instead of being told "Listening" before the
  // recording is actually live.
  const voiceState = isProcessing
    ? 'processing'
    : isListening
      ? 'listening'
      : isPreparing
        ? 'preparing'
        : 'idle';

  const handleClose = useCallback(() => {
    if (isListening) {
      toggle();
    }
    // Don't stop TTS — let it keep playing when overlay closes
    // TTS only stops when user presses mic to start recording
    resetTranscript();
    onClose();
  }, [isListening, toggle, onClose, resetTranscript]);

  const handleMicPress = useCallback(() => {
    unlockTTS();
    // Stop any playing TTS audio so it doesn't overlap with recording
    stopTTS();
    toggle();
  }, [toggle]);

  // When recording stops and we have a NEW transcript, process it
  useEffect(() => {
    if (
      !isListening &&
      transcript &&
      !isProcessing &&
      transcript !== processedTranscriptRef.current
    ) {
      // Mark this transcript as consumed immediately to prevent re-fires
      processedTranscriptRef.current = transcript;

      // Add user message
      const userMsgId = `user-${Date.now()}`;
      const userMsg: VoiceMessage = {
        id: userMsgId,
        role: 'user',
        text: transcript,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // Clear the global transcript so it doesn't trigger again
      resetTranscript();

      // Process the transcript
      processTranscript(transcript, stepContext)
        .then((result) => {
          // Add assistant response message
          const assistantMsgId = `assistant-${Date.now()}`;
          const assistantMsg: VoiceMessage = {
            id: assistantMsgId,
            role: 'ai',
            text: result.message,
          };

          setMessages((prev) => [...prev, assistantMsg]);

          // Speak the AI response aloud
          speak(result.message);

          // If success, wait a bit then close and call onAction
          if (result.success) {
            setTimeout(() => {
              onAction(result);
              // Small delay to let the UI update
              setTimeout(handleClose, 100);
            }, 300);
          } else {
            setIsProcessing(false);
          }
        })
        .catch((err) => {
          console.error('Error processing transcript:', err);
          const errorMsg: VoiceMessage = {
            id: `error-${Date.now()}`,
            role: 'ai',
            text: 'Sorry, something went wrong. Please try again.',
          };
          setMessages((prev) => [...prev, errorMsg]);
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
    handleClose,
    resetTranscript,
    setMessages,
  ]);

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
          <ChatBubble
            key={msg.id}
            role={msg.role}
            text={msg.text}
            userName={user?.name ?? undefined}
          />
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
            disabled={voiceState === 'processing' || voiceState === 'preparing'}
            className="relative flex h-[75px] w-[75px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)] active:scale-95 disabled:active:scale-100"
          >
            <Mic className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
