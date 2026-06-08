import type { OrbState } from './orbState';

// Pure routing decision for the chat overlay's send path.
export type OrbSendAction = 'vapi' | 'onboarding' | 'checkin' | 'llm' | 'noop';

export type OrbSurface = 'onboarding' | 'checkin' | 'coach';

interface Args {
  orbState: OrbState;
  surface: OrbSurface;
  isProcessing: boolean;
  isStreaming: boolean;
}

export function routeOrbSend({
  orbState,
  surface,
  isProcessing,
  isStreaming,
}: Args): OrbSendAction {
  if (isProcessing || isStreaming) return 'noop';
  if (orbState === 'vapi') return 'vapi';
  if (surface === 'onboarding') return 'onboarding';
  if (surface === 'checkin') return 'checkin';
  return 'llm';
}
