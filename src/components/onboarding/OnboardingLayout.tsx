import { Icon } from '@iconify/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { OpenChatButton } from '@/components/home/OpenChatButton';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import {
  OnboardingChatOverlay,
  type VoiceMessage,
} from '@/components/onboarding/OnboardingChatOverlay';
import { OnboardingSubtitleBar } from '@/components/onboarding/OnboardingSubtitleBar';
import { VoiceTooltip } from '@/components/onboarding/VoiceTooltip';
import { DualButton } from '@/components/ui/DualButton';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';
import { useFocusedFieldContext } from '@/hooks/useFocusedFieldContext';
import { type OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { stopTTS, unlockTTS } from '@/lib/services/tts-service';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { AiListeningTooltip } from './AiListeningTooltip';

interface OnboardingLayoutProps {
  currentStep: number;
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
  bgVariant?: 'default' | 'secondary';
}

export function OnboardingLayout({
  currentStep,
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
  bgVariant = 'default',
}: OnboardingLayoutProps) {
  const { isListening, transcript, interim, error, resetTranscript } = useVoiceInput();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const focusedField = useFocusedFieldContext();
  const [tooltipVisible, setTooltipVisible] = useState(
    showTooltip && !localStorage.getItem('onboarding-voice-tooltip-shown'),
  );

  // P1-09 — Vapi is the active voice path for onboarding. The DualButton
  // splits into two independent toggles: LEFT = assistant TTS, RIGHT = mic
  // (STT). Both flip the corresponding user preference on every click so the
  // server-side record reflects what the user has set during the flow.
  const onboardingVoice = useOnboardingVoice();
  const { preferences, updatePreferences } = useUserPreferences();
  const vapiStatus = onboardingVoice?.status ?? 'idle';
  const vapiActive = vapiStatus === 'active';
  const vapiConnecting = vapiStatus === 'connecting';
  const vapiErrored = vapiStatus === 'error';
  const vapiIsMuted = onboardingVoice?.isMuted ?? true;
  const vapiTtsMuted = onboardingVoice?.isTtsMuted ?? false;
  const vapiSpeaking = onboardingVoice?.isAssistantSpeaking ?? false;
  const voiceChosen = preferences.voiceMode === 'voice';
  const micGranted = preferences.micPermission === true;
  const micRuntimeOn = micGranted && preferences.micEnabled === true;
  const ttsOn = voiceChosen && vapiActive && !vapiTtsMuted;
  const micOn = vapiActive ? !vapiIsMuted : micRuntimeOn;

  const voicePlayer = useVoicePlayer();

  useEffect(() => {
    if (voiceFileId) {
      voicePlayer.play(voiceFileId).catch((err) => {
        // Autoplay block / missing manifest entry is expected on most
        // pages (ONBOARD-02..09 are agent screens without pre-recorded
        // MP3 in the Phase 1 manifest). Surface only in dev.
        if (import.meta.env.DEV) {
          console.warn('[OnboardingLayout] Voice autoplay blocked or failed:', err);
        }
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

  const handleOpenChat = () => {
    unlockTTS();
    resetTranscript();
    setOverlayOpen(true);
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
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

  const handleTtsToggleClick = () => {
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
    // When Vapi is in error state, the left orb doubles as the retry control.
    if (vapiErrored) {
      void onboardingVoice?.restartCall();
      return;
    }
    if (vapiActive) {
      const next = vapiTtsMuted;
      onboardingVoice?.setTtsEnabled(next);
      void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
      return;
    }
    const nextChosen = !voiceChosen;
    void updatePreferences({ voiceMode: nextChosen ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: nextChosen });
  };

  const handleMicToggleClick = () => {
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
    if (vapiActive) {
      const next = vapiIsMuted;
      onboardingVoice?.setMicEnabled(next);
      void updatePreferences({ micEnabled: next });
      return;
    }
    if (!micGranted) {
      void (async () => {
        let granted = true;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          granted = false;
        }
        await updatePreferences({ micPermission: granted, micEnabled: granted });
      })();
      return;
    }
    void updatePreferences({ micEnabled: !preferences.micEnabled });
  };

  const voiceControl = showVoiceButton ? (
    <div className="relative my-6 flex flex-col items-center gap-2">
      {tooltipVisible && <VoiceTooltip autoDismissMs={4000} onDismiss={handleTooltipDismiss} />}
      <DualButton
        size={88}
        leftActive={ttsOn || vapiConnecting}
        rightActive={micOn}
        activeRings={ttsOn && vapiSpeaking ? 'left' : null}
        leftIcon={ttsOn ? <IconChatVoice size={30} /> : <IconChatText size={30} />}
        rightIcon={micOn ? <IconMic size={30} /> : <IconMicMuted size={30} />}
        onLeftClick={handleTtsToggleClick}
        onRightClick={handleMicToggleClick}
        leftAriaLabel={ttsOn ? 'Mute coach voice' : 'Unmute coach voice'}
        rightAriaLabel={micOn ? 'Mute mic' : 'Unmute mic'}
      />
      {vapiErrored && (
        <p className="max-w-[280px] text-center text-xs text-danger">
          Couldn't connect to coach voice.
        </p>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`relative flex min-h-dvh flex-col ${bgVariant === 'secondary' ? 'bg-surface-secondary' : 'bg-surface'} px-6 pb-[48px] pt-[max(16px,env(safe-area-inset-top))]`}
    >
      {overlayOpen && (
        <OnboardingChatOverlay
          stepContext={{
            step: currentStep,
            options: voiceOptions,
            prompt: voicePrompt,
            extraData: focusedField ? { focusedField } : undefined,
          }}
          onAction={handleVoiceAction}
          onClose={() => setOverlayOpen(false)}
          messages={voiceMessages}
          setMessages={setVoiceMessages}
        />
      )}

      {!overlayOpen && <OpenChatButton floating onPress={handleOpenChat} />}

      {!overlayOpen && <OnboardingSubtitleBar messages={voiceMessages} />}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} height={16} className="text-content" />
        </button>
      )}
      <div
        className={`-mx-[2px] flex flex-1 flex-col gap-[16px] overflow-y-auto px-[2px] pt-4 ${ctaVariant === 'inline' ? 'pb-[80px]' : 'pb-4'}`}
      >
        {children}
      </div>
      {ctaVariant === 'full' ? (
        <>
          {voiceControl}

          <button
            type="button"
            onClick={handleNext}
            disabled={ctaDisabled}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[18px] font-medium leading-[28px] text-white shadow-[0px_20px_25px_-5px_rgba(26,47,176,0.2),0px_8px_10px_-6px_rgba(26,47,176,0.2)] transition-opacity disabled:opacity-50"
          >
            {ctaLabel}
          </button>

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
          {voiceControl}
          <button
            type="button"
            onClick={handleNext}
            disabled={ctaDisabled}
            className="flex h-[56px] w-full items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] disabled:opacity-50"
          >
            {ctaLabel}
          </button>
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
