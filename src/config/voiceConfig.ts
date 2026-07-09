export type VoiceGender = 'male' | 'female';

// Locked 2026-07-06 (gg-spec/docs/voice-presets.json, "live-coach" preset):
// ONE canonical live-Cartesia voice, Yair's Pro Voice Clone V1, so the live
// coach (profile greeting, check-ins) matches the pre-recorded onboarding MP3
// clips instead of the old generic sonic-3 Ronald/Katie pair. Both genders
// resolve to the same clone; the gender split stays only as an interface seam.
const PRO_VOICE_CLONE_V1 = {
  id: '104635f9-8991-403c-9988-bc5b70b39939',
  name: 'Pro Voice Clone V1',
};
export const CARTESIA_VOICES: Record<VoiceGender, { id: string; name: string }> = {
  male: PRO_VOICE_CLONE_V1,
  female: PRO_VOICE_CLONE_V1,
};
