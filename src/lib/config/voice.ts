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

// ─── Voice chat (useVoiceChat) ──────────────────────────────────────────────
export const VOICE_CHAT_CAP_KEY = 'gg_voice_count';
export const VOICE_CHAT_CAP_DATE_KEY = 'gg_voice_count_date';
export const VOICE_CHAT_MAX_CONVERSATIONS = envNumber(
  import.meta.env.VITE_VOICE_MAX_CONVERSATIONS,
  5,
);

/** TTS duration estimate: ms per character, minimum floor (ms). */
export const VOICE_CHAT_TTS_MS_PER_CHAR = envNumber(import.meta.env.VITE_VOICE_TTS_MS_PER_CHAR, 65);
export const VOICE_CHAT_TTS_MIN_MS = envNumber(import.meta.env.VITE_VOICE_TTS_MIN_MS, 2000);

// ─── STT service (stt-service) ──────────────────────────────────────────────
/** Commands shorter than this (seconds) keep native sample rate for accuracy. */
export const STT_SHORT_COMMAND_THRESHOLD_SECONDS = envNumber(
  import.meta.env.VITE_STT_SHORT_COMMAND_THRESHOLD_SECONDS,
  5,
);
/** Downsample target (Hz) for longer recordings. */
export const STT_DOWNSAMPLE_RATE = envNumber(import.meta.env.VITE_STT_DOWNSAMPLE_RATE, 16000);

// ─── Onboarding voice (useOnboardingVoice) ──────────────────────────────────
/**
 * Spoken-number → digit map used as a safety net when the API returns
 * `[AGE]` (PII-scrubbed) for step 1. Covers 13–99 exhaustively — teens,
 * every tens word, every tens+ones compound (both "twenty one" and
 * "twenty-one" spellings). Longer phrases are ordered first so compounds
 * match before standalone tens.
 */
const TEENS: Record<string, number> = Object.freeze({
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
});

const TENS: Array<[string, number]> = [
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
];

const ONES: Array<[string, number]> = [
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
];

function buildAgeMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [tens, tv] of TENS) {
    for (const [ones, ov] of ONES) {
      map[`${tens} ${ones}`] = tv + ov;
      map[`${tens}-${ones}`] = tv + ov;
    }
    map[tens] = tv;
  }
  Object.assign(map, TEENS);
  return map;
}

export const ONBOARDING_AGE_WORD_TO_NUM: Readonly<Record<string, number>> =
  Object.freeze(buildAgeMap());

// ─── Voice command domain data (useVoiceCommand) ────────────────────────────
/**
 * Common speech-to-text misrecognitions for our app's domain vocabulary.
 *
 * TODO(voice-layer): Alejandro suggested moving fuzzy intent matching into
 * an LLM-backed module; tracked for Phase 2. For now this dictionary is
 * at least centralized so it can be edited without touching hook code.
 */
export const STT_CORRECTIONS: Readonly<Record<string, string>> = Object.freeze({
  matrix: 'metric',
  mattress: 'metric',
  matrices: 'metrics',
  metrix: 'metric',
  matric: 'metric',
  mediation: 'meditation',
  meditating: 'meditation',
  exorcise: 'exercise',
  exercize: 'exercise',
  jogging: 'jogging',
  journaling: 'journal',
  reflexion: 'reflection',
  streak: 'streak',
  habbit: 'habit',
  habbits: 'habits',
});

// ─── Audio debug page (AudioDebugPage) ──────────────────────────────────────
/**
 * Web origin hosting the static MP3 assets used for the remote-MP3 smoke test.
 * Empty string = the remote test is skipped. Set `VITE_AUDIO_DEBUG_WEB_ORIGIN`
 * in the environment to enable. Never hardcode a production URL here.
 */
export const AUDIO_DEBUG_WEB_ORIGIN = envString(import.meta.env.VITE_AUDIO_DEBUG_WEB_ORIGIN, '');

/**
 * Public Supabase Storage base URL for voice assets. Derived from
 * `VITE_SUPABASE_URL` — this is already required for the app to function,
 * so no separate fallback is defined here. Empty string when unset so
 * callers can skip the Supabase smoke test gracefully.
 */
const SUPABASE_URL = envString(import.meta.env.VITE_SUPABASE_URL, '');
export const VOICE_ASSETS_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/voice-assets`
  : '';

/** Alias kept for the AudioDebugPage smoke test; prefer VOICE_ASSETS_BASE_URL. */
export const AUDIO_DEBUG_SUPABASE_STORAGE_BASE = VOICE_ASSETS_BASE_URL;

/**
 * Build a public URL for an MP3 asset in the Supabase `voice-assets` bucket.
 * Falls back to an empty string if the Supabase URL is not configured, which
 * makes the caller's Audio element silently no-op instead of throwing.
 */
export function voiceAssetUrl(filename: string): string {
  if (!VOICE_ASSETS_BASE_URL || VOICE_ASSETS_BASE_URL.includes('placeholder')) return '';
  return `${VOICE_ASSETS_BASE_URL}/${filename}`;
}
