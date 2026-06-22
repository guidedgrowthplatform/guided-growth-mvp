export type OrbRing = 'left' | 'right' | 'ready' | 'idle' | null;

export interface OrbRingState {
  voiceOn: boolean;
  micOn: boolean;
  speaking: boolean;
  listening: boolean;
  micSpeaking: boolean;
}

// Speaking wins (half-duplex, never simultaneous); both-on idle → full circle.
export function deriveOrbRing({
  voiceOn,
  micOn,
  speaking,
  listening,
  micSpeaking,
}: OrbRingState): OrbRing {
  if (voiceOn && speaking) return 'left';
  if (micOn && listening && micSpeaking) return 'right';
  if (voiceOn && micOn) return 'idle';
  if (micOn && listening) return 'ready';
  return null;
}
