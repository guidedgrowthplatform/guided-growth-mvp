/**
 * B28/B29 reveal-pin matrix. The B4 invariant is the anchor: armed-not-started
 * audio pins the karaoke at 0; only playing audio, explicit fallback, or real
 * progress may reveal words.
 */
import { describe, expect, it } from 'vitest';
import { openerRevealPin } from '../openerReveal';

const base = {
  wordCount: 10,
  progress: null as number | null,
  hasOpenerAudio: true,
  playing: false,
  done: false,
  textFallback: false,
};

describe('openerRevealPin', () => {
  it('B4: armed-not-started pins the reveal at 0', () => {
    expect(openerRevealPin(base)).toBe(0);
  });

  it('real progress drives the word count', () => {
    expect(openerRevealPin({ ...base, progress: 0.5 })).toBe(5);
    expect(openerRevealPin({ ...base, progress: 1 })).toBe(10);
  });

  it('B29: playing with no usable duration (null progress) hands reveal to the timer', () => {
    expect(openerRevealPin({ ...base, playing: true })).toBeNull();
  });

  it('B28: the long-hold text fallback hands reveal to the timer', () => {
    expect(openerRevealPin({ ...base, textFallback: true })).toBeNull();
  });

  it('done clip with no progress falls back to the timer (settled state)', () => {
    expect(openerRevealPin({ ...base, done: true })).toBeNull();
  });

  it('no audio opener: karaoke always runs its own timer', () => {
    expect(openerRevealPin({ ...base, hasOpenerAudio: false })).toBeNull();
  });

  it('no opener text: null regardless of audio state', () => {
    expect(openerRevealPin({ ...base, wordCount: 0 })).toBeNull();
  });

  it('progress wins over blocked-state flags (already playing via late gesture)', () => {
    expect(openerRevealPin({ ...base, progress: 0.3, textFallback: true })).toBe(3);
  });

  it('word-accurate revealWords wins over the linear progress interpolation', () => {
    expect(openerRevealPin({ ...base, revealWords: 2, progress: 0.9, playing: true })).toBe(2);
  });

  it('revealWords 0 pins at 0 (leading silence while playing)', () => {
    expect(openerRevealPin({ ...base, revealWords: 0, playing: true })).toBe(0);
  });

  it('revealWords clamps to the display word count', () => {
    expect(openerRevealPin({ ...base, revealWords: 15, playing: true })).toBe(10);
  });

  it('null/absent revealWords changes nothing: B4 pin and progress path intact', () => {
    expect(openerRevealPin({ ...base, revealWords: null })).toBe(0);
    expect(openerRevealPin({ ...base, revealWords: null, progress: 0.5 })).toBe(5);
  });
});
