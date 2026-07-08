/**
 * Word-onset timeline for opener karaoke: maps real speech timings onto the
 * displayed opener words so the reveal is word-accurate, not a linear guess.
 *
 * Two timing sources produce the same shape (onset seconds per display word):
 *  - live Cartesia SSE timestamps (add_timestamps) for TTS'd openers;
 *  - precomputed captions (mlx-whisper, splashCaptions shape) for verbatim
 *    MP3 openers, which can never get SSE timings.
 */

/** Same shape as SPLASH_CAPTIONS (src/components/welcome/splashCaptions.ts). */
interface CaptionWord {
  /** Onset seconds within the clip. */
  t: number;
  w: string;
}
export interface CaptionLine {
  start: number;
  end: number;
  words: CaptionWord[];
}

/**
 * Map spoken-token onsets onto the displayed words (whitespace split). Token
 * counts differ — Cartesia/whisper normalize ("9am" -> "nine","a","m") — so
 * indices scale proportionally, the same mapping cartesiaVoice.scheduleChunk
 * uses. Monotonic, and both sequences end together.
 */
export function onsetsForDisplayWords(spokenStarts: number[], displayWordCount: number): number[] {
  const m = spokenStarts.length;
  if (m === 0 || displayWordCount <= 0) return [];
  const out = new Array<number>(displayWordCount);
  for (let i = 0; i < displayWordCount; i++) {
    const j = Math.min(m - 1, Math.floor((i * m) / displayWordCount));
    out[i] = spokenStarts[j];
  }
  return out;
}

export function onsetsFromCaptions(lines: CaptionLine[]): number[] {
  const out: number[] = [];
  for (const line of lines) for (const word of line.words) out.push(word.t);
  return out;
}

/** Words revealed at playback time t: count of onsets <= t (onsets ascending). */
export function revealCountAtTime(onsets: number[], tSec: number): number {
  let count = 0;
  for (let i = 0; i < onsets.length; i++) {
    if (tSec >= onsets[i]) count = i + 1;
    else break;
  }
  return count;
}

export function countDisplayWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
