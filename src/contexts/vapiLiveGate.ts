import type { MicPausedReason } from '@/stores/voiceSettingsStore';

/**
 * Pure derivation of "should the Vapi call be live right now?".
 *
 * Lifted out of OnboardingVoiceProvider so the gate (especially the idle
 * auto-pause conjunct) is unit-testable without rendering the provider.
 *
 * The idle auto-pause matters for cost: after IDLE_TIMEOUT_MS of silence the
 * idle timer sets micPausedReason='system'. Without `micPausedReason == null`
 * here, the Vapi mic + WebRTC call stayed fully live and kept burning voice
 * minutes (the flag only gated the Soniox STT path). With it, the flag flipping
 * to 'system' makes this return false, and the provider's stop branch tears the
 * call down; a user gesture clears the flag (reactivateIfSystemPaused) and the
 * start branch re-arms Vapi.
 */
export interface VapiLiveGateInput {
  engineIsVapi: boolean;
  micPermission: boolean;
  micEnabled: boolean;
  hasAnonId: boolean;
  fatalError: boolean;
  remoteEndCooldown: boolean;
  voiceCapReached: boolean;
  micPausedReason: MicPausedReason;
}

export function vapiLiveGate(input: VapiLiveGateInput): boolean {
  return (
    input.engineIsVapi &&
    input.micPermission &&
    input.micEnabled &&
    // metadata.anon_id is baked in at start(); a null anonId would ship every
    // tool call with an empty anon_id and the backend rejects them all.
    input.hasAnonId &&
    !input.fatalError &&
    !input.remoteEndCooldown &&
    !input.voiceCapReached &&
    // Idle auto-pause stops the live Vapi call (mirrors the Soniox mic gate).
    input.micPausedReason == null
  );
}
