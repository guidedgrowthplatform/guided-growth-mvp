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
  subscribeTranscripts: (listener: OnboardingTranscriptListener) => () => void;
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
