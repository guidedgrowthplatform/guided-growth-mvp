/**
 * Context + hook for the onboarding-wide Vapi voice session.
 *
 * Split from `OnboardingVoiceProvider.tsx` so the provider file only exports
 * a component (keeps react-refresh HMR working in dev).
 */
import { createContext, useContext } from 'react';

export type OnboardingVoiceStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

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
}

export const OnboardingVoiceContext = createContext<OnboardingVoiceContextValue | null>(null);

export function useOnboardingVoice(): OnboardingVoiceContextValue | null {
  return useContext(OnboardingVoiceContext);
}
