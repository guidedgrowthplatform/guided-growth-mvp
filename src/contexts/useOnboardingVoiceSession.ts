/**
 * Context + hook for the onboarding-wide Vapi voice session.
 *
 * Split from `OnboardingVoiceProvider.tsx` so the provider file only exports
 * a component (keeps react-refresh HMR working in dev).
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import type { RealtimeTranscriptEvent } from '@/hooks/useRealtimeVoice';

export type OnboardingVoiceStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export type OnboardingTranscriptListener = (event: RealtimeTranscriptEvent) => void;

export interface VoiceMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export const USER_SPEAKING_IDLE_MS = 600;

export interface OnboardingVoiceContextValue {
  status: OnboardingVoiceStatus;
  isAssistantSpeaking: boolean;
  isUserSpeaking: boolean;
  errorMessage: string | null;
  currentScreenId: string | null;
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  messages: VoiceMessage[];
  appendMessage: (msg: VoiceMessage) => void;
  endCall: () => void;
  restartCall: () => Promise<void>;
  pushSubScreen: (screenId: string | null) => void;
  // Page-level snapshot of already-filled form fields. Pages call this on
  // each render with their current snapshot (cheap — shallow-compared in the
  // provider). The provider includes it in cold-start assistantOverrides,
  // each pushScreenContext, and a debounced mid-screen "form state update"
  // add-message so Vapi stays in sync without per-keystroke flooding.
  setFormSnapshot: (snapshot: Record<string, unknown>) => void;
  // Force an immediate snapshot push to Vapi (bypasses the 700ms debounce).
  // Used right after the parser dispatches a successful action so Vapi knows
  // about the form change BEFORE formulating its next turn — without this,
  // Vapi can ask "what's your name?" milliseconds after we just filled it.
  flushFormSnapshot: () => void;
  // Feedback loop from the /api/process-command parser back to Vapi.
  // Lands as a [PARSER OK] or [PARSER MISS] system add-message so Vapi can
  // (a) acknowledge naturally on success, or (b) ask the user to repeat
  // clearly on failure. triggerResponseEnabled is false on both — Vapi
  // incorporates into its next response without speaking twice.
  notifyParserResult: (result: ParserResultFeedback) => void;
  subscribeTranscripts: (listener: OnboardingTranscriptListener) => () => void;
  voiceCapReached: boolean;
  dismissVoiceCap: () => void;
}

export type ParserResultFeedback =
  | {
      ok: true;
      transcript: string;
      action: string;
      params: Record<string, unknown>;
    }
  | {
      ok: false;
      transcript: string;
      reason: 'no-extraction' | 'low-confidence';
    };

export const OnboardingVoiceContext = createContext<OnboardingVoiceContextValue | null>(null);

export function useOnboardingVoice(): OnboardingVoiceContextValue | null {
  return useContext(OnboardingVoiceContext);
}

export function useOnboardingTranscripts(
  handler: OnboardingTranscriptListener,
  enabled: boolean = true,
): void {
  const session = useContext(OnboardingVoiceContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const subscribe = session?.subscribeTranscripts;
  useEffect(() => {
    if (!enabled || !subscribe) return;
    return subscribe((evt) => handlerRef.current(evt));
  }, [subscribe, enabled]);
}
