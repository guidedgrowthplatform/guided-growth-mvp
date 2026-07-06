/**
 * Precomputed word-onset captions for MP3 beat openers — the second timing
 * source of the opener karaoke (the first is live Cartesia SSE timestamps,
 * which a baked MP3 can never have).
 *
 * Generate with mlx-whisper against the shipped clip, same as
 * src/components/welcome/splashCaptions.ts (identical shape).
 *
 * TWO key forms are accepted (A1 + the render's caption delivery):
 *   - clip NAME, no extension (e.g. "state_sleep", "onboard_fork_form_1"):
 *     the render session's clipCaptions.ts format, so its Record<clipName,
 *     CaptionLine[]> content pastes in UNCHANGED. Lookup derives the name
 *     from the src basename, so /voice/ob/state_sleep.wav finds "state_sleep".
 *   - full clip src (e.g. "/voice/onboarding/<clip>.mp3"): the original form,
 *     still honored first for exact-path entries.
 *
 * A clip with no entry keeps today's duration-fraction reveal — adding
 * captions here upgrades it to word-accurate with zero code change.
 */
import type { CaptionLine } from '@/lib/voice/openerWordTimeline';
import { onsetsFromCaptions } from '@/lib/voice/openerWordTimeline';

const OPENER_CAPTIONS: Record<string, CaptionLine[]> = {
  // '/voice/onboarding/<clip>.mp3': [...] or '<clip-name>': [...]
  // Lane B: paste the render's clipCaptions.ts entries here (clip-name keys).
};

/** "/voice/ob/state_sleep.wav" -> "state_sleep" (the clip-name key form). */
function clipNameFromSrc(src: string): string {
  const base = src.slice(src.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export function openerCaptionOnsets(src: string | null): number[] | null {
  if (!src) return null;
  const lines = OPENER_CAPTIONS[src] ?? OPENER_CAPTIONS[clipNameFromSrc(src)];
  if (!lines || lines.length === 0) return null;
  const onsets = onsetsFromCaptions(lines);
  return onsets.length > 0 ? onsets : null;
}
