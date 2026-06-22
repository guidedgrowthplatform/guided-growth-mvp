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

// Adaptive end-of-turn windows (Phase 1). TURN_AGGREGATION_MS is the base/ambiguous
// pause; a transcript that SOUNDS finished flushes sooner, one that sounds
// mid-thought (trailing "and"/"because"/an article) waits longer so the user isn't
// cut off. Both MUST stay below VAD_SILENCE_CLOSE_MS in soniox-stream.ts (incl. a
// margin for Soniox final latency) or the socket closes mid-pause and re-arms.
export const TURN_PAUSE_COMPLETE_MS = 900;
export const TURN_PAUSE_INCOMPLETE_MS = 2800;

// Full-duplex barge-in: keep the mic HOT while the coach is speaking so the user
// can interrupt mid-reply (instead of the half-duplex mute that deafens the mic
// during playback). Relies on the browser's echo cancellation — clean on
// headphones; on loud speakers without good AEC the coach's own voice can leak
// into the mic and self-interrupt. Flip to false to restore strict half-duplex.
export const FULL_DUPLEX_BARGE_IN = true;
