/**
 * narrationSchedule — the pure sequencing rules of the narration driver
 * (Lane A A1). Given a beat's narration[] and the index of the segment
 * currently playing, derive everything the view needs. No React, no audio:
 * the invariants stay unit-testable in isolation, the same split as
 * openerReveal/openerTurns.
 *
 * The segment model (STEP-0 contract, ../types.ts NarrationSegment):
 *   - segments run strictly in ARRAY ORDER, one at a time;
 *   - kind 'bubble': a coach bubble; its say karaokes with its audio;
 *   - kind 'reveal': the card's nth element blooms as the segment STARTS,
 *     while its say (if any) is spoken verbal-only (never drawn as a bubble);
 *     n = 99 means "all remaining elements";
 *   - kind 'close': a coach bubble spoken AFTER the beat's interaction
 *     completes (never part of the pre-interaction script; the driver plays
 *     closes when the capture fires, then forwards it);
 *   - a segment with a clip advances when its audio settles; a segment with
 *     no clip advances on the text-cadence dwell below (matches BeatPlayer's
 *     fallback so silent beats read the same as before).
 *
 * NO EM DASHES.
 */
import type { NarrationSegment } from '../../types';
import { countWords } from '../useCoachSpeechReveal';

/** Sentinel n meaning "every remaining element" (the render's convention). */
export const REVEAL_ALL = 99;

/** The pre-interaction script: every segment except the closes, in order. */
export function scriptSegments(segments: NarrationSegment[]): NarrationSegment[] {
  return segments.filter((s) => s.kind !== 'close');
}

/** The close script: segments spoken after the interaction, in order. */
export function closeSegments(segments: NarrationSegment[]): NarrationSegment[] {
  return segments.filter((s) => s.kind === 'close');
}

/** The bubble segments visible once segment `activeIdx` is playing (0-based). */
export function visibleBubbles(
  segments: NarrationSegment[],
  activeIdx: number,
): { segIdx: number; say: string }[] {
  const out: { segIdx: number; say: string }[] = [];
  segments.forEach((seg, i) => {
    if (i > activeIdx) return;
    if (seg.kind === 'bubble' && seg.say) out.push({ segIdx: i, say: seg.say });
  });
  return out;
}

/**
 * How many card elements are revealed once segment `activeIdx` is playing:
 * the highest reveal n reached so far (blooms START with their segment).
 * 0 = the card is not revealed yet; REVEAL_ALL = everything.
 */
export function revealCountAt(segments: NarrationSegment[], activeIdx: number): number {
  let n = 0;
  segments.forEach((seg, i) => {
    if (i > activeIdx) return;
    if (seg.kind === 'reveal') n = Math.max(n, seg.n);
  });
  return n;
}

/**
 * Whether the card is on screen at segment `activeIdx`: from the first reveal
 * segment onward, or (for narration with no reveal segments) once every
 * segment has finished (activeIdx past the end).
 */
export function cardVisibleAt(segments: NarrationSegment[], activeIdx: number): boolean {
  const firstReveal = segments.findIndex((s) => s.kind === 'reveal');
  if (firstReveal >= 0) return activeIdx >= firstReveal;
  return activeIdx >= segments.length;
}

/** True once every segment has played (the card takes over). */
export function narrationDone(segments: NarrationSegment[], activeIdx: number): boolean {
  return activeIdx >= segments.length;
}

/**
 * Dwell for a segment with NO clip: long enough for the fixed-cadence karaoke
 * to finish its say (BeatPlayer's fallback numbers), a short breath otherwise.
 */
export function silentDwellMs(seg: NarrationSegment): number {
  if (seg.say) return 650 + countWords(seg.say) * 110;
  return 450;
}
