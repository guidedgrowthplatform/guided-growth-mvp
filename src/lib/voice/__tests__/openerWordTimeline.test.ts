import { describe, expect, it } from 'vitest';
import {
  countDisplayWords,
  onsetsForDisplayWords,
  onsetsFromCaptions,
  revealCountAtTime,
} from '../openerWordTimeline';

describe('onsetsForDisplayWords', () => {
  it('maps 1:1 when spoken and display counts match', () => {
    expect(onsetsForDisplayWords([0, 0.4, 0.9], 3)).toEqual([0, 0.4, 0.9]);
  });

  it('scales proportionally when Cartesia tokenizes more words than displayed ("9am" -> three tokens)', () => {
    // 6 spoken tokens over 3 display words: each display word gets every 2nd onset.
    expect(onsetsForDisplayWords([0, 0.2, 0.4, 0.6, 0.8, 1.0], 3)).toEqual([0, 0.4, 0.8]);
  });

  it('scales proportionally when spoken has fewer tokens than displayed', () => {
    // 2 spoken tokens over 4 display words: first half maps to onset 0, second to 0.5.
    expect(onsetsForDisplayWords([0, 0.5], 4)).toEqual([0, 0, 0.5, 0.5]);
  });

  it('is monotonic non-decreasing for ascending input', () => {
    const out = onsetsForDisplayWords([0.1, 0.3, 0.35, 0.8, 1.2], 7);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
  });

  it('returns [] for empty starts or zero display words', () => {
    expect(onsetsForDisplayWords([], 5)).toEqual([]);
    expect(onsetsForDisplayWords([0.1], 0)).toEqual([]);
  });
});

describe('revealCountAtTime', () => {
  const onsets = [0, 0.4, 0.9, 1.5];

  it('reveals the first word at its onset', () => {
    expect(revealCountAtTime(onsets, 0)).toBe(1);
  });

  it('counts every onset at or before t', () => {
    expect(revealCountAtTime(onsets, 0.39)).toBe(1);
    expect(revealCountAtTime(onsets, 0.4)).toBe(2);
    expect(revealCountAtTime(onsets, 1.0)).toBe(3);
    expect(revealCountAtTime(onsets, 99)).toBe(4);
  });

  it('reveals nothing before the first onset', () => {
    expect(revealCountAtTime([0.5, 1.0], 0.2)).toBe(0);
    expect(revealCountAtTime([], 5)).toBe(0);
  });
});

describe('onsetsFromCaptions', () => {
  it('flattens caption lines into a single onset list (splashCaptions shape)', () => {
    const lines = [
      {
        start: 0,
        end: 2,
        words: [
          { t: 0, w: 'Hey,' },
          { t: 0.68, w: 'I' },
        ],
      },
      { start: 2, end: 3, words: [{ t: 2.1, w: 'am' }] },
    ];
    expect(onsetsFromCaptions(lines)).toEqual([0, 0.68, 2.1]);
  });
});

describe('countDisplayWords', () => {
  it('splits on whitespace, ignoring padding and blanks', () => {
    expect(countDisplayWords('  Hey there,   friend! ')).toBe(3);
    expect(countDisplayWords('')).toBe(0);
    expect(countDisplayWords('   ')).toBe(0);
  });
});
