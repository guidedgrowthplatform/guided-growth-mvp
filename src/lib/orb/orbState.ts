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

export interface ResolveActiveRingsInput {
  isVoiceInOnly: boolean;
  voiceInListening: boolean;
  micSpeaking: boolean;
  micRuntimeOn: boolean;
  isUserSpeaking: boolean;
  voiceChosen: boolean;
  /**
   * Whether the coach side should show as actively speaking. Bug fix (MP3
   * orb dead): this must be a signal that reflects ANY real coach-audio
   * source (the coachAudioBus tap that covers MP3/Cartesia playback, per
   * useCoachVoiceActivity's `speaking` field) — NOT just Vapi's own
   * `isAssistantSpeaking` flag. Vapi is silent for the whole duration of an
   * MP3-opener beat (the MP3 element plays instead of Vapi talking), so
   * gating this on `isAssistantSpeaking` alone left the orb dead for every
   * MP3 coach line while Cartesia/Vapi playback (which does flip that flag)
   * kept working — see gg-spec MR "fix(orb): left orb reacts to MP3 coach
   * playback, not only Cartesia".
   */
  coachSpeaking: boolean;
  vapiActive: boolean;
}

/**
 * Single source of truth for which ring (`activeRings`) the shared
 * FlowVoiceControls/OnboardingChatOverlay orb sites resolve to. Extracted so
 * the two render sites can't drift out of sync with each other, and so the
 * coach/user precedence rules are covered by a direct unit test instead of
 * only ever being exercised through a fully mounted component tree.
 */
export function resolveActiveRings(input: ResolveActiveRingsInput): ActiveRings {
  const {
    isVoiceInOnly,
    voiceInListening,
    micSpeaking,
    micRuntimeOn,
    isUserSpeaking,
    voiceChosen,
    coachSpeaking,
    vapiActive,
  } = input;
  if (isVoiceInOnly && voiceInListening) return micSpeaking ? 'right' : 'ready';
  if (micRuntimeOn && isUserSpeaking) return 'right';
  if (voiceChosen && coachSpeaking) return 'left';
  if (vapiActive) return 'idle';
  return null;
}
