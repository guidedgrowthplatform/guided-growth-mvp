export type OrbState = 'vapi' | 'voice_out_only' | 'voice_in_only' | 'text_only';

export function orbStateFrom(voiceOn: boolean, micOn: boolean): OrbState {
  if (voiceOn && micOn) return 'vapi';
  if (voiceOn && !micOn) return 'voice_out_only';
  if (!voiceOn && micOn) return 'voice_in_only';
  return 'text_only';
}

export type ActiveRings = 'left' | 'right' | 'ready' | 'idle' | null;

export interface ResolvedOrbMic {
  on: boolean;
  amp: number;
}

/**
 * B51: merges coach ('left') and user-mic ('right'/'ready') amplitude into
 * the single OrbMic the canonical Orb reads. Before this, `on`/`amp` were
 * hardwired to the user-mic side only (`on: activeRings === 'right'`), so the
 * coach-speaking half never pulsed at all.
 *
 * Amp is applied whenever a live level exists for the side currently active,
 * INDEPENDENT of whether activeRings has flipped to that exact ring state —
 * this is deliberate: some callers (e.g. FlowVoiceControls in full Vapi mode)
 * have a real user-mic amplitude reading even while activeRings sits at
 * 'ready' rather than 'right', and a ring-state gap must never silently zero
 * out real amplitude. Falls back to the pre-B51 behavior (`on` gated strictly
 * to 'right', amp = userAmp) when neither side has a positive live level, so
 * idle/ready visuals are unchanged.
 */
export function resolveOrbMic(
  activeRings: ActiveRings,
  coachAmp: number,
  userAmp: number,
): ResolvedOrbMic {
  if (activeRings === 'left' && coachAmp > 0) {
    return { on: true, amp: coachAmp };
  }
  if ((activeRings === 'right' || activeRings === 'ready') && userAmp > 0) {
    return { on: true, amp: userAmp };
  }
  return { on: activeRings === 'right', amp: userAmp };
}
