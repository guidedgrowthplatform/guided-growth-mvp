export type VoiceGender = 'male' | 'female';

// Coach Yair cloned voice. "Yair English, Pro Voice Clone, V1". This is the ONE
// voice across the app: it must match the Vapi assistant's voice exactly so the
// onboarding hand-off (Cartesia opener -> Vapi conversation) is seamless. Pair it
// with model sonic-3.5-2026-05-04 on the HTTP TTS path.
export const COACH_VOICE_ID = '104635f9-8991-403c-9988-bc5b70b39939';

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

// Own-voice echo gate (full-duplex): while the coach is audibly speaking, ignore
// mic input below BARGE_MIN_RMS as the coach's own leaked TTS, so it can't
// self-interrupt. Real user speech sits well above this. Set BARGE_ECHO_GATE
// false to restore unconditional barge-in.
export const BARGE_ECHO_GATE = true;
// Just above SPEECH_RMS_THRESHOLD (0.005) — AEC-attenuated echo falls under it.
export const BARGE_MIN_RMS = 0.006;
export const BARGE_MIN_CHARS = 2;
// Let a low-energy final through if long enough — off by default (would reopen
// the long-echo hole on weak-AEC devices).
export const BARGE_REQUIRE_FINAL_FOR_LOW_ENERGY = false;
export const BARGE_SUSTAIN_FRAMES = 2;

// Render + speak the MCHECK/ECHECK opener client-side (no LLM round-trip).
// Off until device-verified; flip on to enable the instant opener.
export const CHECKIN_LOCAL_OPENER = false;
