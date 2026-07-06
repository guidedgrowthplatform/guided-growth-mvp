/**
 * Context + hook for the onboarding-wide Vapi voice session.
 *
 * Split from `OnboardingVoiceProvider.tsx` so the provider file only exports
 * a component (keeps react-refresh HMR working in dev).
 */
import { createContext, useContext, useEffect, useRef } from 'react';
import type { RealtimeTranscriptEvent } from '@/hooks/useRealtimeVoice';
import type { OnboardingCard } from '@/lib/onboarding/onboardingChatTypes';

export interface OnboardingVoiceResult {
  success: boolean;
  action: string;
  params: Record<string, unknown>;
  message: string;
  confidence: number;
}

export type OnboardingVoiceActionListener = (result: OnboardingVoiceResult) => void;

export type OnboardingVoiceStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export type OnboardingTranscriptListener = (event: RealtimeTranscriptEvent) => void;

export interface VoiceMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  // Inline chat-native onboarding cards (reserved for per-message card history).
  cards?: OnboardingCard[];
  // The beat (screen_id) this turn belongs to, so the chat-native feed can group
  // dialogue under its beat and keep every prior beat scrollable.
  screenId?: string;
  // Origin of the turn — gates server-side persistence. Only 'vapi'/'opener' are
  // mirrored to chat_messages; Direct-LLM turns are already persisted by the
  // backend and error bubbles must never persist.
  source?: 'vapi' | 'direct_llm' | 'opener' | 'error';
}

export const USER_SPEAKING_IDLE_MS = 600;

export interface OnboardingVoiceContextValue {
  status: OnboardingVoiceStatus;
  isAssistantSpeaking: boolean;
  isUserSpeaking: boolean;
  // voice-in mic armed/listening; orb-ring source (isUserSpeaking is Vapi-only)
  voiceInListening: boolean;
  // B51: real-time amplitude, 0..1, for the in-flow orb's voice-reactive pulse.
  // assistantVolumeLevel comes straight from Vapi's 'volume-level' event;
  // userAudioLevel from Daily's local-audio-level observer (real signal even
  // during a live Vapi call, when audioMetricsStore's Soniox-fed RMS is not
  // running). Both are 0 when no call is active.
  assistantVolumeLevel: number;
  userAudioLevel: number;
  errorMessage: string | null;
  currentScreenId: string | null;
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  messages: VoiceMessage[];
  // Live word-reveal for the cold-start Cartesia opener, paced by the real audio
  // playback so the karaoke syncs to the voice. Scoped by screenId.
  openerReveal?: { screenId: string; revealedWords: number } | null;
  appendMessage: (msg: VoiceMessage) => void;
  // Text path only; idempotent per screenId. Voice resets via onCallStart.
  startThread: (
    screenId: string,
    initial: VoiceMessage[],
    mode?: 'replace' | 'append-if-empty' | 'append',
  ) => void;
  // Unified send for the Direct-LLM path (text composer + voice-in final).
  sendUserTurn: (text: string) => void;
  // True while an LLM turn is in flight (drives composer-disabled + typing dots).
  chatBusy: boolean;
  // True for ASSISTANT_MERGE_WINDOW_MS after the last assistant final transcript;
  // the overlay uses this to render incoming assistant partials INLINE with the
  // last AI bubble (continuous text growth) instead of as a separate streaming
  // bubble below (which would flicker as finals merge in).
  assistantMergeOpen: boolean;
  // LLM tool calls surface here so pages can react (radio updates, etc).
  subscribeVoiceActions: (listener: OnboardingVoiceActionListener) => () => void;
  // Page registers its canonical screen_id + advance handler with the provider.
  registerScreen: (screenId: string | null) => void;
  registerAdvance: (cb: (() => void) | null) => void;
  setScreenContextDeferred: (screenId: string, deferred: boolean) => void;
  endCall: () => void;
  restartCall: () => Promise<void>;
  pushSubScreen: (screenId: string | null) => void;
  // Page-level snapshot of already-filled form fields. Pages call this on
  // each render with their current snapshot (cheap — shallow-compared in the
  // provider). The provider includes it in cold-start assistantOverrides,
  // each pushScreenContext, and a debounced mid-screen "form state update"
  // add-message so Vapi stays in sync without per-keystroke flooding.
  setFormSnapshot: (snapshot: Record<string, unknown>) => void;
  subscribeTranscripts: (listener: OnboardingTranscriptListener) => () => void;
  voiceCapReached: boolean;
  dismissVoiceCap: () => void;
}

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

export function useOnboardingVoiceActions(
  handler: OnboardingVoiceActionListener,
  enabled: boolean = true,
): void {
  const session = useContext(OnboardingVoiceContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const subscribe = session?.subscribeVoiceActions;
  useEffect(() => {
    if (!enabled || !subscribe) return;
    return subscribe((r) => handlerRef.current(r));
  }, [subscribe, enabled]);
}
