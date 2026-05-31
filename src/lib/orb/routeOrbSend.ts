import type { OrbState } from './orbState';

// Pure routing decision for the chat overlay's send path.
export type OrbSendAction = 'vapi' | 'onboarding' | 'llm' | 'noop';

interface Args {
  orbState: OrbState;
  isOnboardingScreen: boolean;
  isProcessing: boolean;
  isStreaming: boolean;
}

export function routeOrbSend({
  orbState,
  isOnboardingScreen,
  isProcessing,
  isStreaming,
}: Args): OrbSendAction {
  if (isProcessing || isStreaming) return 'noop';
  if (orbState === 'vapi') return 'vapi';
  return isOnboardingScreen ? 'onboarding' : 'llm';
}
