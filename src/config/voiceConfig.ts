export type VoiceGender = 'male' | 'female';

// Coach Yair cloned voice — post-onboarding coach TTS
export const COACH_VOICE_ID = '0a974815-0e4d-4dfc-b478-37a7b943da70';

// End-of-turn "think pause": quiet gap after the last Soniox final before the
// buffered utterance is sent as ONE turn (GitLab #209). Longer = more room to
// pause mid-thought (lists, hesitations) without being cut off; trade-off is a
// slightly later coach reply. MUST stay below VAD_SILENCE_CLOSE_MS in
// soniox-stream.ts so the paid socket outlives this window and a late resume can
// re-arm the timer via interims instead of being lost.
export const TURN_AGGREGATION_MS = 2000;
