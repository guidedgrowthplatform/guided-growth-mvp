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
// Vapi is paused by default and only turned on via the QA toggle
// (localStorage: gg_vapi_enabled). The env flag remains read here so the
// rollout path stays visible, but it does not enable Vapi while paused.
const ONBOARDING_CHAT_VAPI_ENV_REQUESTED =
  import.meta.env.VITE_ONBOARDING_CHAT_VAPI === 'true';
const ONBOARDING_CHAT_VAPI_PAUSED_BY_DEFAULT = true;

const readOnboardingChatVapi = (): boolean => {
  try {
    const stored = localStorage.getItem('gg_vapi_enabled');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // SSR or blocked localStorage: keep Vapi paused by default.
  }

  return ONBOARDING_CHAT_VAPI_ENV_REQUESTED && !ONBOARDING_CHAT_VAPI_PAUSED_BY_DEFAULT;
};

// Fixed for the life of the page. The QA toggle reloads so the engine re-reads it.
export const ONBOARDING_CHAT_VAPI = readOnboardingChatVapi();

// ─── Onboarding instant personalized opener ─────────────────────────────────
// Hides the Vapi cold-start latency (vapi_first_audio_ms 7-18s) on the FIRST
// Vapi-covered voice beat. When on, the coach's opener is spoken instantly by
// Cartesia (with the user's name) while Vapi connects silently in the
// background, and the mic opens only once BOTH the opener audio has finished
// AND Vapi is connected. DEFAULT OFF: with the flag off the current voice path
// is byte-for-byte unchanged (Vapi speaks first, as today). Only affects the
// first cold-start beat; later beats are already warm and unaffected.
export const ONBOARDING_INSTANT_OPENER = import.meta.env.VITE_ONBOARDING_INSTANT_OPENER === 'true';

// ─── Onboarding Vapi idle auto-pause ────────────────────────────────────────
// After this many ms of CONTINUOUS user silence, the live Vapi call is paused
// (systemPauseMic → vapiShouldBeLive false → call torn down) to save voice
// minutes; a user gesture re-arms it. 8s is aggressive for an ACTIVE guided
// conversation — a normal think-pause reads as "Vapi shut down for no reason."
// Override (e.g. 600000 to effectively keep the call live while testing) via
// VITE_ONBOARDING_VAPI_IDLE_TIMEOUT_MS. Default unchanged.
export const ONBOARDING_VAPI_IDLE_TIMEOUT_MS = envNumber(
  import.meta.env.VITE_ONBOARDING_VAPI_IDLE_TIMEOUT_MS,
  8000,
);

// ─── Vapi (Path 1) daily cap ────────────────────────────────────────────────
// gg-spec UX-12: 5 realtime (Vapi) voice sessions per calendar day.
// Reverted from the 25 test override on 2026-07-05 (release prep).
// Overridable via VITE_VAPI_DAILY_CAP for QA only.
export const VAPI_DAILY_CAP = envNumber(import.meta.env.VITE_VAPI_DAILY_CAP, 5);
export const VAPI_CAP_DISABLED = import.meta.env.VITE_VOICE_CAP_DISABLED === '1';

// Payload flag set on a `voice_started` event by first-run onboarding voice.
// Cap-exempt starts do NOT count toward VAPI_DAILY_CAP, so onboarding never
// consumes the daily coach-chat allowance and is never blocked by the cap.
// The anti-abuse ceiling for exempt onboarding voice is enforced separately
// (server/infra backstop — see the fix report on this branch).
export const CAP_EXEMPT_PAYLOAD_KEY = 'cap_exempt';

interface CapPayload {
  voice_vendor?: string;
  cap_exempt?: boolean;
}

export interface CapCountableEvent {
  event_type: string;
  timestamp: string;
  payload?: CapPayload | Record<string, unknown> | null;
}

/**
 * Count today's cap-COUNTABLE Vapi voice sessions. A `voice_started` event
 * counts when it is Vapi-vendored, dated today, and NOT cap-exempt. Onboarding
 * marks its starts cap_exempt (see CAP_EXEMPT_PAYLOAD_KEY), so onboarding voice
 * never consumes the daily cap.
 */
export function countVapiToday(
  events: ReadonlyArray<CapCountableEvent>,
  now: Date = new Date(),
): number {
  const today = now.toDateString();
  let n = 0;
  for (const e of events) {
    if (e.event_type !== 'voice_started') continue;
    const p = e.payload as CapPayload | null | undefined;
    if (p?.voice_vendor !== 'vapi') continue;
    if (p?.cap_exempt === true) continue;
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
