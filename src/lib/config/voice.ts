/**
 * Central voice-system configuration.
 *
 * Addresses MR !60 review (Alejandro): hardcoded values scattered across
 * voice hooks/services. All magic numbers, URLs, and domain data for the
 * voice pipeline live here so they can be tuned from one place and
 * overridden via Vite env vars where appropriate.
 */

const envNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const envString = (raw: string | undefined, fallback: string): string => {
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

// ─── Path 3 voice-in (streaming) ────────────────────────────────────
// Env-backed kill-switch; voice-in only. Remove once stable in prod.
export const VOICE_IN_ENABLED = import.meta.env.VITE_STATE3_ENABLED === 'true';

// ─── Onboarding chat-native Vapi (full-duplex) ──────────────────────────────
// Gates Vapi full-duplex on the single-page chat onboarding. Off unless set.
export const ONBOARDING_CHAT_VAPI = import.meta.env.VITE_ONBOARDING_CHAT_VAPI === 'true';

// ─── Onboarding instant personalized opener ─────────────────────────────────
// Hides the Vapi cold-start latency (vapi_first_audio_ms 7-18s) on the FIRST
// Vapi-covered voice beat. When on, the coach's opener is spoken instantly by
// Cartesia (with the user's name) while Vapi connects silently in the
// background, and the mic opens only once BOTH the opener audio has finished
// AND Vapi is connected. DEFAULT OFF: with the flag off the current voice path
// is byte-for-byte unchanged (Vapi speaks first, as today). Only affects the
// first cold-start beat; later beats are already warm and unaffected.
export const ONBOARDING_INSTANT_OPENER = import.meta.env.VITE_ONBOARDING_INSTANT_OPENER === 'true';

// ─── Vapi (Path 1) daily cap ────────────────────────────────────────────────
// Test override; gg-spec UX-12 says 5. Revert before launch.
export const VAPI_DAILY_CAP = envNumber(import.meta.env.VITE_VAPI_DAILY_CAP, 25);
export const VAPI_CAP_DISABLED = import.meta.env.VITE_VOICE_CAP_DISABLED === '1';

export interface CapCountableEvent {
  event_type: string;
  timestamp: string;
  payload?: { voice_vendor?: string } | Record<string, unknown> | null;
}

export function countVapiToday(
  events: ReadonlyArray<CapCountableEvent>,
  now: Date = new Date(),
): number {
  const today = now.toDateString();
  let n = 0;
  for (const e of events) {
    if (e.event_type !== 'voice_started') continue;
    const p = e.payload as { voice_vendor?: string } | null | undefined;
    if (p?.voice_vendor !== 'vapi') continue;
    if (new Date(e.timestamp).toDateString() !== today) continue;
    n += 1;
  }
  return n;
}

/**
 * Public Supabase Storage base URL for voice assets. Derived from
 * `VITE_SUPABASE_URL` — this is already required for the app to function,
 * so no separate fallback is defined here. Empty string when unset so
 * callers can skip the Supabase smoke test gracefully.
 */
const SUPABASE_URL = envString(import.meta.env.VITE_SUPABASE_URL, '');
const VOICE_ASSETS_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/voice-assets`
  : '';

/**
 * Build a public URL for an MP3 asset in the Supabase `voice-assets` bucket.
 * Falls back to an empty string if the Supabase URL is not configured, which
 * makes the caller's Audio element silently no-op instead of throwing.
 */
export function voiceAssetUrl(filename: string): string {
  if (!VOICE_ASSETS_BASE_URL) return '';
  return `${VOICE_ASSETS_BASE_URL}/${filename}`;
}
