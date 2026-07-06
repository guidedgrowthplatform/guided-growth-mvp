/**
 * Narration clip resolution (Lane A A1, onboarding-consolidation-plan-2026-07-06).
 *
 * A narration segment's `clip` is an MP3-verbatim ref authored in the flow
 * document. Resolution order (reconciled with the Lane B converter, !443):
 *   1. the beat's mp3Assets entry whose id matches: its file wins (the
 *      converter resolves clip ids via mp3Assets, so an authored asset path
 *      is authoritative);
 *   2. an absolute public path (e.g. "/voice/onboard_state_check.mp3"): used
 *      as-is, so existing clips keep working without renames;
 *   3. the clip id under the consolidation's asset home: /voice/ob/<id>.wav
 *      (Lane B lands the files there).
 *
 * Captions: per-word caption data lives in openerCaptions.ts, keyed by clip
 * NAME (the render's clipCaptions.ts delivery format) with a resolved-src
 * fallback. useBeatOpenerMp3 picks captions up by src on its own, so a clip
 * gains word-accurate karaoke the moment its caption entry lands, with no
 * driver change (the engine rule: caption entry when present, duration
 * fraction otherwise).
 *
 * NO EM DASHES. Pure leaf module.
 */
import type { BeatRuntimeMeta } from '../../types';

type Mp3Assets = NonNullable<BeatRuntimeMeta['voiceOut']['mp3Assets']>;

/** Resolve a narration clip ref to a playable public src. */
export function narrationClipSrc(clip: string, mp3Assets?: Mp3Assets): string {
  const asset = mp3Assets?.find((a) => a.id === clip);
  if (asset?.file) return asset.file;
  if (clip.startsWith('/')) return clip;
  return `/voice/ob/${clip}.wav`;
}
