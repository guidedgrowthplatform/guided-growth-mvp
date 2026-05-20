/**
 * Context + hook for the onboarding-wide Vapi voice session.
 *
 * Split from `OnboardingVoiceProvider.tsx` so the provider file only exports
 * a component (keeps react-refresh HMR working in dev).
 */
import { createContext, useContext } from 'react';
import type { RealtimeTranscriptEvent } from '@/hooks/useRealtimeVoice';

export type OnboardingVoiceStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export type OnboardingTranscriptListener = (event: RealtimeTranscriptEvent) => void;

export interface OnboardingVoiceContextValue {
  status: OnboardingVoiceStatus;
  isMuted: boolean;
  isTtsMuted: boolean;
  isAssistantSpeaking: boolean;
  errorMessage: string | null;
  currentScreenId: string | null;
  toggleMute: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  endCall: () => void;
  restartCall: () => Promise<void>;
  // Push a screen_context for a sub-screen surface that has no route of its
  // own (e.g. a bottom-sheet overlay). Pass null to revert to the route-derived
  // screen. Used by ONBOARD-BEGINNER-04/-05 inside the habit-customize sheet.
  pushSubScreen: (screenId: string | null) => void;
  // Subscribe to Vapi transcript events (user STT + assistant TTS, partial +
  // final). Returns an unsubscribe function. Listener identity may be unstable;
  // the registration itself is stable.
  subscribeTranscripts: (listener: OnboardingTranscriptListener) => () => void;
}

export const OnboardingVoiceContext = createContext<OnboardingVoiceContextValue | null>(null);

export function useOnboardingVoice(): OnboardingVoiceContextValue | null {
  return useContext(OnboardingVoiceContext);
}
