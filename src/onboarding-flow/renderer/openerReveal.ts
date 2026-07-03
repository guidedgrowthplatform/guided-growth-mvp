/**
 * openerRevealPin, the ONE decision for how many opener words the karaoke may
 * reveal (B28/B29). Pure so the invariants are unit-tested:
 *
 *  - B4 (sacred): a clip that is ARMED but not started (autoplay hold, cold
 *    buffer) pins the reveal to 0. The beat never reads as done with no audio.
 *  - B29: once audio IS playing, a missing/infinite duration (progress stays
 *    null) must not keep the pin at 0 for the whole clip (the blank-white-box
 *    field bug). null hands the reveal to the karaoke's own timer.
 *  - B28: after a long autoplay hold (textFallback), words reveal on the timer
 *    so the beat never reads frozen; the tap-to-play affordance stays on top,
 *    and the clip still only SETTLES by playing or explicit user action.
 */
export interface OpenerRevealArgs {
  /** Word count of the opener text (0 = no opener). */
  wordCount: number;
  /** Playback fraction 0..1, or null while unknown (not started / no duration). */
  progress: number | null;
  /** Beat has an audio opener (MP3 clip or live Cartesia). */
  hasOpenerAudio: boolean;
  /** Audio element is actively playing. */
  playing: boolean;
  /** Clip finished, failed, or was stopped. */
  done: boolean;
  /** Autoplay hold exceeded the text-fallback window (B28). */
  textFallback: boolean;
}

/**
 * Returns the reveal count for Karaoke/BeatPlayer: a number pins the reveal,
 * null lets the karaoke run its own timer.
 */
export function openerRevealPin(args: OpenerRevealArgs): number | null {
  const { wordCount, progress, hasOpenerAudio, playing, done, textFallback } = args;
  if (wordCount <= 0) return null;
  if (progress !== null) return Math.round(progress * wordCount);
  if (hasOpenerAudio && !done) {
    // B29: playing with no usable duration metadata: reveal on the timer.
    if (playing) return null;
    // B28: held past the fallback window: reveal text, keep the affordance.
    if (textFallback) return null;
    // B4: armed-not-started holds at zero.
    return 0;
  }
  return null;
}
