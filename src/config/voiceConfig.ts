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

// Hard ceiling on how long a buffered utterance may keep deferring its flush.
// Every partial/final re-arms the pause timer, so steady speech (a user
// repeating themselves while the coach is silent) could starve the flush
// forever — silence with zero dispatches. Past this hold the buffer flushes
// even if the user is still talking; the remainder becomes the next turn.
export const TURN_HOLD_MAX_MS = 6000;

// onboarding chat-native voice: mic stays hot during TTS (AEC handles echo).
export const FULL_DUPLEX_BARGE_IN = true;

// Render + speak the MCHECK/ECHECK opener client-side (no LLM round-trip).
// Off until device-verified; flip on to enable the instant opener.
export const CHECKIN_LOCAL_OPENER = false;

// M1 latency lane: dispatch on Soniox's own semantic turn-end signal instead of
// waiting out the adaptive armFlush() pause. Off until device-verified; flip on
// to let a true end-of-turn (v5 endpoint token / finished:true) shortcut the
// timer while keeping multi-final buffering and the TURN_HOLD_MAX_MS ceiling
// live as the safety net (see .frugal-fable/m1-audit/findings.md section 3).
export const SEMANTIC_TURN_END = import.meta.env.VITE_SEMANTIC_TURN_END === 'true';

// Model bump to Soniox stt-rt-v5, independent of SEMANTIC_TURN_END (audit risk
// 6: ship the model bump alone first, confirm transcript-quality parity,
// before layering the dispatch change on top). Off = byte-identical v4 request.
export const SONIOX_V5 = import.meta.env.VITE_SONIOX_V5 === 'true';

// Short absorb window used in place of the adaptive armFlush() delay when a
// semantic turn-end fires: long enough to let a same-breath continuation
// re-arm the normal timer, short enough that a true end-of-turn still reads
// as "instant" to the user.
export const SEMANTIC_ABSORB_MS = 250;
