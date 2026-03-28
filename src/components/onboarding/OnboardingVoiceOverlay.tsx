import { Icon } from '@iconify/react';
import { Mic, X } from 'lucide-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import {
  useOnboardingVoice,
  type OnboardingStepContext,
  type OnboardingVoiceResult,
} from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { unlockTTS } from '@/lib/services/tts-service';

interface OnboardingVoiceOverlayProps {
  stepContext: OnboardingStepContext;
  onAction: (result: OnboardingVoiceResult) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const stateLabel: Record<string, string> = {
  idle: 'Tap to speak',
  listening: 'Listening',
  processing: 'Thinking...',
};

export function OnboardingVoiceOverlay({
  stepContext,
  onAction,
  onClose,
}: OnboardingVoiceOverlayProps) {
  const { isListening, transcript, toggle } = useVoiceInput();
  const { processTranscript } = useOnboardingVoice();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Determine the voice state
  const voiceState = isProcessing ? 'processing' : isListening ? 'listening' : 'idle';

  const handleClose = useCallback(() => {
    if (isListening) {
      toggle();
    }
    onClose();
  }, [isListening, toggle, onClose]);

  const handleMicPress = useCallback(() => {
    unlockTTS();
    toggle();
  }, [toggle]);

  // When recording stops and we have a transcript, process it
  useEffect(() => {
    if (!isListening && transcript && !isProcessing) {
      // Add user message
      const userMsgId = `user-${Date.now()}`;
      const userMsg: Message = {
        id: userMsgId,
        role: 'user',
        text: transcript,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // Process the transcript
      processTranscript(transcript, stepContext)
        .then((result) => {
          // Add assistant response message
          const assistantMsgId = `assistant-${Date.now()}`;
          const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'ai',
            text: result.message,
          };

          setMessages((prev) => [...prev, assistantMsg]);

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
          const errorMsg: Message = {
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
        {messages.length === 0 && (
          <div className="text-center text-white/60">
            <p className="text-sm">{stepContext.prompt}</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} text={msg.text} />
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
