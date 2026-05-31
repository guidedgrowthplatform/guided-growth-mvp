import { Icon } from '@iconify/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { OpenChatButton } from '@/components/home/OpenChatButton';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { OnboardingChatOverlay } from '@/components/onboarding/OnboardingChatOverlay';
import { OnboardingSubtitleBar } from '@/components/onboarding/OnboardingSubtitleBar';
import { VoiceTooltip } from '@/components/onboarding/VoiceTooltip';
import { DualButton } from '@/components/ui/DualButton';
import {
  useOnboardingTranscripts,
  useOnboardingVoice,
  useOnboardingVoiceActions,
} from '@/contexts/useOnboardingVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useFocusedFieldContext } from '@/hooks/useFocusedFieldContext';
import { useMicRingIntensity } from '@/hooks/useMicRingIntensity';
import { useOnboardingRealtimeSync } from '@/hooks/useOnboardingRealtimeSync';
import {
  type OnboardingVoiceResult,
  useOnboardingVoice as useOnboardingVoiceHook,
} from '@/hooks/useOnboardingVoice';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { orbStateFrom } from '@/lib/orb/orbState';
import { stopTTS, unlockTTS } from '@/lib/services/tts-service';
import { AiListeningTooltip } from './AiListeningTooltip';

// Single-token (or token-with-punctuation) utterances that are pure
// conversational backchannel — affirmations, hesitations, greetings.
// These never carry form values, so they're not worth a parser round-trip.
// Vapi's own LLM responds to them naturally in parallel.
const BACKCHANNEL_TOKENS = new Set([
  'yeah',
  'yes',
  'yep',
  'yup',
  'ok',
  'okay',
  'sure',
  'right',
  'mhm',
  'mmhm',
  'uh huh',
  'uh-huh',
  'no',
  'nope',
  'nah',
  'thanks',
  'thank you',
  'cool',
  'great',
  'awesome',
  'hi',
  'hey',
  'hello',
  'um',
  'uh',
  'hmm',
  'huh',
  'wait',
]);
function isConversationalBackchannel(text: string): boolean {
  // Strip trailing punctuation + lowercase, then compare against the set.
  // Multi-word entries like "uh huh" / "thank you" matter, so check first.
  const cleaned = text
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
    .trim();
  if (BACKCHANNEL_TOKENS.has(cleaned)) return true;
  // Also catch very short utterances (< 3 chars) — too short to plausibly
  // be a form value worth round-tripping.
  if (cleaned.length < 3) return true;
  return false;
}

// Screens that have migrated off the legacy /api/process-command parser onto
// dedicated Vapi tools. On these screens the Vapi LLM calls our tool webhook
// directly (e.g. submit_profile → /api/vapi/tool), which writes Supabase and
// the frontend picks up the change via Realtime. Running the parser in
// parallel would race with the tool write and burn a GPT round-trip.
const VAPI_TOOL_DRIVEN_SCREENS = new Set<string>([
  'ONBOARD-01--FORM',
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-ADVANCED',
]);

interface OnboardingLayoutProps {
  currentStep: number;
  ctaLabel: string;
  onNext: () => void;
  ctaDisabled?: boolean;
  children: ReactNode;
  showVoiceButton?: boolean;
  hideOpenChat?: boolean;
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
  screenId?: string;
  // Snapshot of filled form fields (persisted + in-flight) — typically
  // produced by useOnboardingFormSnapshot({...overrides}). Threaded into
  // /api/process-command's filled_fields and pushed to Vapi via the
  // provider's setFormSnapshot so both LLMs see what's already known.
  formSnapshot?: Record<string, unknown>;
}

export function OnboardingLayout({
  currentStep,
  ctaLabel,
  onNext,
  ctaDisabled,
  children,
  showVoiceButton,
  hideOpenChat = false,
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
  screenId,
  formSnapshot,
}: OnboardingLayoutProps) {
  const { isListening, transcript, interim, error, resetTranscript } = useVoiceInput();
  const focusedField = useFocusedFieldContext();
  // Server-side tool writes (Vapi `submit_profile` etc.) update onboarding_states
  // directly. Subscribe here so the postgres_changes broadcast lands in React
  // Query cache and the form auto-fills without a refetch.
  useOnboardingRealtimeSync();
  const [tooltipVisible, setTooltipVisible] = useState(
    showTooltip && !localStorage.getItem('onboarding-voice-tooltip-shown'),
  );

  const onboardingVoice = useOnboardingVoice();
  const { voiceOn, micOn, micAllowed, toggleVoice, toggleMic, requestMicPermission } =
    useDualButtonControls();
  const vapiStatus = onboardingVoice?.status ?? 'idle';
  const vapiErrored = vapiStatus === 'error';
  const vapiSpeaking = onboardingVoice?.isAssistantSpeaking ?? false;
  const vapiUserSpeaking = onboardingVoice?.isUserSpeaking ?? false;
  const overlayOpen = onboardingVoice?.overlayOpen ?? false;
  const openOverlay = onboardingVoice!.openOverlay;
  const closeOverlay = onboardingVoice!.closeOverlay;
  const ttsOn = voiceOn && !vapiErrored;
  // Page orb rings/ripples in voice-in even with the overlay closed (UX-18).
  const isVoiceInOnly = orbStateFrom(voiceOn, micOn) === 'voice_in_only';
  const voiceInListening = onboardingVoice?.voiceInListening ?? false;
  const micRingIntensity = useMicRingIntensity(isVoiceInOnly && voiceInListening);

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

  const prevTranscriptRef = useRef(transcript);
  useEffect(() => {
    if (onTranscript && transcript && transcript !== prevTranscriptRef.current && !isListening) {
      onTranscript(transcript);
    }
    prevTranscriptRef.current = transcript;
  }, [transcript, isListening, onTranscript]);

  // Voice → form fill: subscribe to Vapi user transcripts at the page level
  // (independent of the chat overlay). On each final user utterance, POST it
  // to /api/process-command and forward the structured action to the page's
  // onVoiceAction handler. This makes "say your nickname" actually fill the
  // form whether or not the chat overlay is open.
  //
  // Active whenever onVoiceAction is provided. The overlay's own listener
  // (OnboardingChatOverlay.tsx:93) only handles assistant transcripts, so
  // there's no double-processing.
  //
  // Time-based debounce (USER_FINAL_DEBOUNCE_MS): Vapi STT sometimes emits
  // a second final transcript moments after the first when ambient noise is
  // captured (e.g. "Male" → "Male" + a phantom "White."). Both would be
  // valid-looking utterances with different text, so an exact-match dedup
  // doesn't catch it. Drop any final transcript that arrives within the
  // window. Users who legitimately want to change a field can re-speak
  // after the window expires.
  const USER_FINAL_DEBOUNCE_MS = 1500;
  const { processTranscript } = useOnboardingVoiceHook();
  const lastProcessedAtRef = useRef<number>(0);
  const lastProcessedTextRef = useRef<string>('');
  const handleUserFinal = useCallback(
    (text: string) => {
      if (!onVoiceAction) return;
      if (!text) return;
      if (screenId && VAPI_TOOL_DRIVEN_SCREENS.has(screenId)) {
        if (import.meta.env.DEV) {
          console.debug(
            '[onboarding-voice] skipped legacy parser — Vapi tool path:',
            screenId,
            text,
          );
        }
        return;
      }
      // Skip obvious conversational backchannel — short pure-affirmation /
      // acknowledgment utterances Vapi handles fine on its own. No point
      // burning a /api/process-command call (and a GPT round-trip) just to
      // get action=error back. Vapi's conversational LLM responds to these
      // naturally in parallel.
      if (isConversationalBackchannel(text)) {
        if (import.meta.env.DEV) {
          console.debug('[onboarding-voice] skipped backchannel transcript:', text);
        }
        return;
      }
      const now = Date.now();
      if (text === lastProcessedTextRef.current) return;
      if (now - lastProcessedAtRef.current < USER_FINAL_DEBOUNCE_MS) {
        if (import.meta.env.DEV) {
          console.debug('[onboarding-voice] debounced final transcript:', text);
        }
        return;
      }
      lastProcessedAtRef.current = now;
      lastProcessedTextRef.current = text;
      void processTranscript(text, {
        step: currentStep,
        screen_id: screenId,
        options: voiceOptions,
        prompt: voicePrompt,
        filled_fields: formSnapshot,
        extraData: focusedField ? { focusedField } : undefined,
      })
        .then((result) => {
          if (result.success) {
            onVoiceAction(result);
            // Bypass the 700ms snapshot debounce — Vapi may be formulating
            // its next turn right now and would otherwise re-ask for the
            // just-filled field. The flush sends an immediate add-message
            // with the latest snapshot (triggerResponseEnabled: false).
            onboardingVoice?.flushFormSnapshot();
            onboardingVoice?.notifyParserResult({
              ok: true,
              transcript: text,
              action: result.action,
              params: result.params,
            });
          } else {
            onboardingVoice?.notifyParserResult({
              ok: false,
              transcript: text,
              reason: (result.confidence ?? 0) < 0.5 ? 'low-confidence' : 'no-extraction',
            });
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.warn('[onboarding-voice] processTranscript:', err);
        });
    },
    [
      onVoiceAction,
      processTranscript,
      currentStep,
      screenId,
      voiceOptions,
      voicePrompt,
      focusedField,
      formSnapshot,
      onboardingVoice,
    ],
  );

  useOnboardingTranscripts((evt) => {
    if (evt.role !== 'user' || evt.kind !== 'final') return;
    handleUserFinal(evt.text.trim());
  }, !!onVoiceAction);

  // LLM tool calls (now provider-owned) drive this page's onVoiceAction.
  useOnboardingVoiceActions((r) => handleVoiceAction(r), !!onVoiceAction);

  // Push the current snapshot to the provider on every render. The provider
  // shallow-compares against its own ref and only schedules a debounced Vapi
  // push when something actually changed — so this is cheap even when called
  // every render. Skipped entirely when no snapshot is supplied.
  useEffect(() => {
    if (!formSnapshot) return;
    if (!onboardingVoice) {
      if (import.meta.env.DEV) {
        console.debug('[onboarding-voice] setFormSnapshot skipped — no provider in tree');
      }
      return;
    }
    onboardingVoice.setFormSnapshot(formSnapshot);
  }, [formSnapshot, onboardingVoice]);

  const handleOpenChat = () => {
    unlockTTS();
    resetTranscript();
    openOverlay();
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

  // Register this page's screen_id + advance handler so the provider-owned LLM
  // keys context correctly and confirm_step_complete advances the right page.
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const registerScreen = onboardingVoice?.registerScreen;
  const registerAdvance = onboardingVoice?.registerAdvance;
  useEffect(() => {
    if (!registerScreen) return;
    registerScreen(screenId ?? null);
    return () => registerScreen(null);
  }, [registerScreen, screenId]);
  useEffect(() => {
    if (!registerAdvance) return;
    registerAdvance(() => handleNextRef.current());
    return () => registerAdvance(null);
  }, [registerAdvance]);

  const handleTooltipDismiss = () => {
    setTooltipVisible(false);
    localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
  };

  const handleTtsToggleClick = () => {
    handleTooltipDismiss();
    if (vapiErrored) {
      void onboardingVoice?.restartCall();
      return;
    }
    toggleVoice();
  };

  const handleMicToggleClick = () => {
    handleTooltipDismiss();
    if (!micAllowed) {
      void requestMicPermission();
      return;
    }
    toggleMic();
  };

  const voiceControl = showVoiceButton ? (
    <div className="relative my-6 flex flex-col items-center gap-2">
      {tooltipVisible && <VoiceTooltip autoDismissMs={4000} onDismiss={handleTooltipDismiss} />}
      <DualButton
        size={88}
        leftActive={ttsOn}
        rightActive={micOn}
        activeRings={
          isVoiceInOnly && voiceInListening
            ? 'right'
            : ttsOn && vapiSpeaking
              ? 'left'
              : micOn && vapiUserSpeaking
                ? 'right'
                : vapiStatus === 'active'
                  ? 'idle'
                  : null
        }
        intensity={isVoiceInOnly && voiceInListening ? micRingIntensity : undefined}
        leftIcon={ttsOn ? <IconChatVoice size={30} /> : <IconChatText size={30} />}
        rightIcon={micOn ? <IconMic size={30} /> : <IconMicMuted size={30} />}
        onLeftClick={handleTtsToggleClick}
        onRightClick={handleMicToggleClick}
        leftAriaLabel={ttsOn ? 'Turn coach voice off' : 'Turn coach voice on'}
        rightAriaLabel={micOn ? 'Mute mic' : 'Unmute mic'}
      />
      {vapiErrored && (
        <p className="max-w-[280px] text-center text-xs text-danger">
          Couldn't connect to coach voice.
          {import.meta.env.DEV && onboardingVoice?.errorMessage && (
            <span className="mt-1 block break-all font-mono text-[10px] opacity-70">
              {onboardingVoice.errorMessage}
            </span>
          )}
        </p>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`relative flex min-h-dvh flex-col ${bgVariant === 'secondary' ? 'bg-surface-secondary' : 'bg-surface'} px-6 pb-[48px] pt-[max(16px,env(safe-area-inset-top))]`}
    >
      {overlayOpen && <OnboardingChatOverlay key={currentStep} onClose={closeOverlay} />}

      {!overlayOpen && !hideOpenChat && <OpenChatButton floating onPress={handleOpenChat} />}

      {!overlayOpen && <OnboardingSubtitleBar />}

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
        className={`flex flex-1 flex-col gap-[16px] pt-4 ${ctaVariant === 'inline' ? 'pb-[80px]' : 'pb-4'}`}
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
