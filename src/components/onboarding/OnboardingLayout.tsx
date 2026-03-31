import { Icon } from '@iconify/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { OnboardingVoiceOverlay } from '@/components/onboarding/OnboardingVoiceOverlay';
import { VoiceTooltip } from '@/components/onboarding/VoiceTooltip';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
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
  onVoiceAction,
  showTooltip = false,
}: OnboardingLayoutProps) {
  const { isListening, toggle, transcript, interim, error } = useVoiceInput();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(
    showTooltip && !localStorage.getItem('onboarding-voice-tooltip-shown'),
  );
  const [autoAdvanceMsg, setAutoAdvanceMsg] = useState(false);
  const voiceSuccessRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous transcript to detect new completions
  const prevTranscriptRef = useRef(transcript);
  useEffect(() => {
    if (onTranscript && transcript && transcript !== prevTranscriptRef.current && !isListening) {
      onTranscript(transcript);
    }
    prevTranscriptRef.current = transcript;
  }, [transcript, isListening, onTranscript]);

  const handleMicClick = () => {
    // If we have onVoiceAction, use the new overlay-based flow
    if (onVoiceAction && voiceOptions.length > 0) {
      setOverlayOpen(true);
      setTooltipVisible(false);
      // Mark tooltip as seen
      localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
    } else {
      // Fallback to old inline voice behavior
      toggle();
    }
  };

  const handleVoiceAction = useCallback(
    (result: OnboardingVoiceResult) => {
      if (onVoiceAction) {
        onVoiceAction(result);
        if (result.success && result.confidence >= 0.5) {
          voiceSuccessRef.current = true;
        }
      }
    },
    [onVoiceAction],
  );

  // Auto-advance: when voice succeeded, overlay closed, and all fields are filled
  useEffect(() => {
    if (voiceSuccessRef.current && !ctaDisabled && !overlayOpen) {
      voiceSuccessRef.current = false;
      setAutoAdvanceMsg(true);

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceMsg(false);
        onNext();
      }, 1500);
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [ctaDisabled, overlayOpen, onNext]);

  const handleTooltipDismiss = () => {
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-[24px] pb-[48px] pt-[max(16px,env(safe-area-inset-top))]">
      {overlayOpen && (
        <OnboardingVoiceOverlay
          stepContext={{
            step: currentStep,
            options: voiceOptions,
            prompt: voicePrompt,
          }}
          onAction={handleVoiceAction}
          onClose={() => setOverlayOpen(false)}
        />
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex size-[40px] items-center justify-center rounded-full"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
      )}
      <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />

      {/* Voice auto-advance indicator */}
      {autoAdvanceMsg && (
        <div className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 animate-[fadeInDown_0.3s_ease-out] rounded-full bg-green-500/90 px-5 py-2 shadow-lg backdrop-blur-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <Icon icon="ic:round-check-circle" width={18} height={18} />
            Moving on...
          </p>
        </div>
      )}
      <div
        className={`-mx-[2px] flex flex-1 flex-col gap-[16px] overflow-y-auto px-[2px] pt-4 ${ctaVariant === 'inline' ? 'pb-[80px]' : 'pb-4'}`}
      >
        {children}
      </div>
      {ctaVariant === 'full' ? (
        <>
          {showVoiceButton && (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="relative">
                {tooltipVisible && (
                  <VoiceTooltip autoDismissMs={4000} onDismiss={handleTooltipDismiss} />
                )}
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`flex h-[56px] w-[56px] items-center justify-center rounded-full shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)] transition-colors ${
                    isListening && !onVoiceAction ? 'bg-red-500' : ''
                  }`}
                  style={
                    isListening && !onVoiceAction
                      ? undefined
                      : { background: 'linear-gradient(135deg, #135bec 0%, #2563eb 100%)' }
                  }
                >
                  <Icon
                    icon={isListening && !onVoiceAction ? 'ic:round-stop' : 'ic:round-mic'}
                    width={22}
                    height={22}
                    className="text-white"
                  />
                </button>
              </div>
              {isListening && !onVoiceAction && (
                <p className="animate-pulse text-sm font-medium text-primary">Listening...</p>
              )}
              {interim && !isListening && !onVoiceAction && (
                <p className="text-xs text-content-secondary">{interim}</p>
              )}
              {transcript && !onVoiceAction && (
                <p className="max-w-[280px] text-center text-sm text-content">{transcript}</p>
              )}
              {error && !onVoiceAction && (
                <p className="max-w-[280px] text-center text-xs text-red-500">{error}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={ctaDisabled}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[20px] text-[18px] font-medium leading-[28px] text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2),0px_8px_10px_-6px_rgba(26,47,176,0.2)] disabled:opacity-50"
          >
            {ctaLabel}
            <Icon icon="ic:round-arrow-forward" width={18} height={18} />
          </button>
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
        <div className="relative -mx-[24px] -mb-[48px] bg-gradient-to-t from-surface-secondary via-surface-secondary to-transparent px-[24px] pb-[40px] pt-[24px]">
          {aiListeningPrompt && (
            <div className="absolute bottom-full right-[24px] z-10 mb-[-8px]">
              <AiListeningTooltip
                text={transcript || aiListeningPrompt}
                visible={isListening || !!transcript}
              />
            </div>
          )}
          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={onNext}
              disabled={ctaDisabled}
              className="flex h-[56px] flex-1 items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] disabled:opacity-50"
            >
              {ctaLabel}
            </button>
            {showVoiceButton && (
              <button
                type="button"
                onClick={handleMicClick}
                className={`flex size-[56px] shrink-0 items-center justify-center rounded-full shadow-[0px_25px_50px_-12px_rgba(19,91,236,0.4)] transition-colors ${
                  isListening && !onVoiceAction ? 'bg-red-500' : 'bg-primary'
                }`}
              >
                <Icon
                  icon={isListening && !onVoiceAction ? 'ic:round-stop' : 'ic:round-mic'}
                  width={22}
                  height={22}
                  className="text-white"
                />
              </button>
            )}
          </div>
          {(transcript || interim || error) && showVoiceButton && !onVoiceAction && (
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
