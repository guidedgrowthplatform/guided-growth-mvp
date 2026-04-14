import { Icon } from '@iconify/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  OnboardingVoiceOverlay,
  type VoiceMessage,
} from '@/components/onboarding/OnboardingVoiceOverlay';
import { VoiceTooltip } from '@/components/onboarding/VoiceTooltip';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { speak, stopTTS, unlockTTS } from '@/lib/services/tts-service';
import { AiListeningTooltip } from './AiListeningTooltip';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps: number;
  ctaLabel: string;
  onNext: () => void;
  ctaDisabled?: boolean;
  children: ReactNode;
  showVoiceButton?: boolean;
  onBack?: () => void;
  ctaVariant?: 'full' | 'inline';
  aiListeningPrompt?: string;
  footerText?: string;
  secondaryAction?: { label: string; onClick: () => void };
  onTranscript?: (text: string) => void;
  // New voice overlay props
  voiceOptions?: string[];
  voicePrompt?: string;
  voiceFileId?: string;
  onVoiceAction?: (result: OnboardingVoiceResult) => void;
  showTooltip?: boolean;
}

export function OnboardingLayout({
  currentStep,
  totalSteps,
  ctaLabel,
  onNext,
  ctaDisabled,
  children,
  showVoiceButton,
  onBack,
  ctaVariant = 'full',
  aiListeningPrompt,
  footerText,
  onTranscript,
  secondaryAction,
  voiceOptions = [],
  voicePrompt = '',
  voiceFileId,
  onVoiceAction,
  showTooltip = false,
}: OnboardingLayoutProps) {
  const { isListening, toggle, transcript, interim, error, resetTranscript } = useVoiceInput();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [tooltipVisible, setTooltipVisible] = useState(
    showTooltip && !localStorage.getItem('onboarding-voice-tooltip-shown'),
  );

  const voicePlayer = useVoicePlayer();

  useEffect(() => {
    if (voiceFileId) {
      voicePlayer.play(voiceFileId).catch((err) => {
        console.warn('[OnboardingLayout] Voice autoplay blocked or failed:', err);
      });
    }
    // Only run on mount or when fileId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceFileId]);

  // Persist voice chat messages across overlay open/close
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>(() => [
    { id: 'prompt', role: 'ai', text: voicePrompt || 'Hey — welcome. What can I help you with?' },
  ]);

  // Track previous transcript to detect new completions
  const prevTranscriptRef = useRef(transcript);
  useEffect(() => {
    if (onTranscript && transcript && transcript !== prevTranscriptRef.current && !isListening) {
      onTranscript(transcript);
    }
    prevTranscriptRef.current = transcript;
  }, [transcript, isListening, onTranscript]);

  const hasSpokePrompt = useRef(false);

  const handleMicClick = () => {
    // ALWAYS stop any playing audio first
    stopTTS();
    voicePlayer.stop();
    unlockTTS();
    // If we have onVoiceAction, use the new overlay-based flow
    if (onVoiceAction && voiceOptions.length > 0) {
      // Clear any stale transcript before opening overlay
      resetTranscript();
      setOverlayOpen(true);
      setTooltipVisible(false);
      // Speak the prompt first time overlay opens (user gesture = always works)
      if (!hasSpokePrompt.current && voicePrompt && ttsEnabled) {
        hasSpokePrompt.current = true;
        speak(voicePrompt);
      }
      // Mark tooltip as seen
      localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
    } else {
      // Fallback to old inline voice behavior
      toggle();
    }
  };

  const handleToggleTts = () => {
    if (ttsEnabled) stopTTS();
    setTtsEnabled((v) => !v);
  };

  const handleVoiceAction = (result: OnboardingVoiceResult) => {
    if (onVoiceAction) {
      onVoiceAction(result);
    }
  };

  // Wrap onNext to stop current TTS + unlock for next page
  const handleNext = () => {
    stopTTS();
    unlockTTS();
    onNext();
  };

  const handleTooltipDismiss = () => {
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[48px] pt-[max(16px,env(safe-area-inset-top))]">
      {overlayOpen && (
        <OnboardingVoiceOverlay
          stepContext={{
            step: currentStep,
            options: voiceOptions,
            prompt: voicePrompt,
          }}
          onAction={handleVoiceAction}
          onClose={() => setOverlayOpen(false)}
          messages={voiceMessages}
          setMessages={setVoiceMessages}
          ttsEnabled={ttsEnabled}
        />
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
      )}
      <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />
      <div
        className={`-mx-[2px] flex flex-1 flex-col gap-[16px] overflow-y-auto px-[2px] pt-4 ${ctaVariant === 'inline' ? 'pb-[80px]' : 'pb-4'}`}
      >
        {children}
      </div>
      {ctaVariant === 'full' ? (
        <>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={handleNext}
              disabled={ctaDisabled}
              className="flex h-[56px] flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[18px] font-medium leading-[28px] text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2),0px_8px_10px_-6px_rgba(26,47,176,0.2)] transition-opacity disabled:opacity-50"
            >
              {ctaLabel}
            </button>

            {showVoiceButton && (
              <>
                {/* TTS speaker toggle */}
                <button
                  type="button"
                  onClick={handleToggleTts}
                  className={`flex size-[52px] shrink-0 items-center justify-center rounded-full transition-colors ${
                    ttsEnabled ? 'bg-primary' : 'bg-surface-secondary'
                  }`}
                >
                  <Icon
                    icon={ttsEnabled ? 'ic:round-volume-up' : 'ic:round-volume-off'}
                    width={22}
                    height={22}
                    className={ttsEnabled ? 'text-white' : 'text-content-tertiary'}
                  />
                </button>

                {/* Mic toggle */}
                <div className="relative shrink-0">
                  {tooltipVisible && (
                    <VoiceTooltip autoDismissMs={4000} onDismiss={handleTooltipDismiss} />
                  )}
                  <button
                    type="button"
                    onClick={handleMicClick}
                    className={`flex size-[52px] items-center justify-center rounded-full transition-colors ${
                      isListening ? 'bg-primary' : 'bg-surface-secondary'
                    }`}
                  >
                    <Icon
                      icon={isListening ? 'ic:round-mic' : 'ic:round-mic-off'}
                      width={22}
                      height={22}
                      className={isListening ? 'text-white' : 'text-content-tertiary'}
                    />
                  </button>
                </div>
              </>
            )}
          </div>

          {showVoiceButton && !onVoiceAction && (isListening || interim || transcript || error) && (
            <div className="mt-2 flex flex-col items-center gap-1">
              {isListening && (
                <p className="animate-pulse text-sm font-medium text-primary">Listening...</p>
              )}
              {interim && !isListening && (
                <p className="text-xs text-content-secondary">{interim}</p>
              )}
              {transcript && (
                <p className="max-w-[280px] text-center text-sm text-content">{transcript}</p>
              )}
              {error && <p className="max-w-[280px] text-center text-xs text-danger">{error}</p>}
            </div>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="w-full py-[12px] text-center text-[16px] font-semibold text-content"
            >
              {secondaryAction.label}
            </button>
          )}
        </>
      ) : (
        <div className="relative -mx-6 -mb-12 bg-gradient-to-t from-surface via-surface to-transparent px-6 pb-[40px] pt-[24px]">
          {aiListeningPrompt && !overlayOpen && (
            <div className="absolute bottom-full right-[24px] z-10 mb-[-8px]">
              <AiListeningTooltip
                text={transcript || aiListeningPrompt}
                visible={isListening || !!transcript}
              />
            </div>
          )}
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={handleNext}
              disabled={ctaDisabled}
              className="flex h-[56px] flex-1 items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] disabled:opacity-50"
            >
              {ctaLabel}
            </button>
            {showVoiceButton && (
              <>
                <button
                  type="button"
                  onClick={handleToggleTts}
                  className={`flex size-[52px] shrink-0 items-center justify-center rounded-full transition-colors ${
                    ttsEnabled ? 'bg-primary' : 'bg-surface-secondary'
                  }`}
                >
                  <Icon
                    icon={ttsEnabled ? 'ic:round-volume-up' : 'ic:round-volume-off'}
                    width={22}
                    height={22}
                    className={ttsEnabled ? 'text-white' : 'text-content-tertiary'}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`flex size-[52px] shrink-0 items-center justify-center rounded-full transition-colors ${
                    isListening ? 'bg-primary' : 'bg-surface-secondary'
                  }`}
                >
                  <Icon
                    icon={isListening ? 'ic:round-mic' : 'ic:round-mic-off'}
                    width={22}
                    height={22}
                    className={isListening ? 'text-white' : 'text-content-tertiary'}
                  />
                </button>
              </>
            )}
          </div>
          {(transcript || interim || error) &&
            showVoiceButton &&
            !onVoiceAction &&
            !overlayOpen && (
              <div className="mt-[8px] flex flex-col items-center gap-1">
                {interim && <p className="text-xs text-content-secondary">{interim}</p>}
                {transcript && (
                  <p className="max-w-full text-center text-sm text-content">{transcript}</p>
                )}
                {error && <p className="max-w-full text-center text-xs text-red-500">{error}</p>}
              </div>
            )}
          {footerText && (
            <p className="mt-[12px] text-center text-[12px] font-medium text-content-tertiary">
              {footerText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
