/**
 * Narration clip resolution (Lane A A1, onboarding-consolidation-plan-2026-07-06).
 *
 * A narration segment's `clip` is an MP3-verbatim ref authored in the flow
 * document. Two forms are accepted:
 *   - a clip id (e.g. "state_sleep"): resolves to /voice/ob/<id>.wav, the
 *     consolidation's asset home (Lane B lands the files there);
 *   - an absolute public path (e.g. "/voice/onboard_state_check.mp3"): used
 *     as-is, so existing clips keep working without renames.
 *
 * Captions: per-word caption data for a clip lives in openerCaptions.ts keyed
 * by the RESOLVED src. useBeatOpenerMp3 picks captions up by src on its own,
 * so a clip gains word-accurate karaoke the moment its caption entry lands,
 * with no driver change (the engine rule: caption file when present, duration
 * fraction otherwise). Lane B ingests the render session's caption data there.
 *
 * NO EM DASHES. Pure leaf module.
 */

/** Resolve a narration clip ref to a playable public src. */
export function narrationClipSrc(clip: string): string {
  if (clip.startsWith('/')) return clip;
  return `/voice/ob/${clip}.wav`;
}
