export type OrbState = 'vapi' | 'voice_out_only' | 'voice_in_only' | 'text_only';

export function orbStateFrom(voiceOn: boolean, micOn: boolean): OrbState {
  if (voiceOn && micOn) return 'vapi';
  if (voiceOn && !micOn) return 'voice_out_only';
  if (!voiceOn && micOn) return 'voice_in_only';
  return 'text_only';
}
