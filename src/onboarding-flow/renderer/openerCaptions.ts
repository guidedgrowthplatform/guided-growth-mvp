/**
 * Precomputed word-onset captions for MP3 beat openers — the second timing
 * source of the opener karaoke (the first is live Cartesia SSE timestamps,
 * which a baked MP3 can never have).
 *
 * Generate with mlx-whisper against the shipped clip, same as
 * src/components/welcome/splashCaptions.ts (identical shape). Keyed by the
 * clip src used in the beat's meta.mp3Assets[0].file. A clip with no entry
 * keeps today's duration-fraction reveal — adding captions here upgrades it
 * to word-accurate with zero code change.
 */
import type { CaptionLine } from '@/lib/voice/openerWordTimeline';
import { onsetsFromCaptions } from '@/lib/voice/openerWordTimeline';

const OPENER_CAPTIONS: Record<string, CaptionLine[]> = {
  // '/voice/onboarding/<clip>.mp3': [...]  (none yet — verbatim openers planned)
};

export function openerCaptionOnsets(src: string | null): number[] | null {
  if (!src) return null;
  const lines = OPENER_CAPTIONS[src];
  if (!lines || lines.length === 0) return null;
  const onsets = onsetsFromCaptions(lines);
  return onsets.length > 0 ? onsets : null;
}
