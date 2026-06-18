// Scripted check-in flow (gg-spec, 2026-06-17 call). When ON, the morning/evening
// check-ins run as a deterministic, pre-scripted ritual (Cartesia TTS / text
// bubbles, no LLM-improvised wording). When OFF (default), the existing
// LLM-driven check-in is unchanged.
export const SCRIPTED_CHECKIN_ENABLED = import.meta.env.VITE_SCRIPTED_CHECKIN === 'true';
