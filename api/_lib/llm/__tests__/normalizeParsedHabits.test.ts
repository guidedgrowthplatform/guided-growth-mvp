import { describe, expect, it } from 'vitest';
import { normalizeParsedHabits } from '../normalizeParsedHabits.js';

describe('normalizeParsedHabits', () => {
  it('returns [] for non-object / missing habits', () => {
    expect(normalizeParsedHabits(null)).toEqual([]);
    expect(normalizeParsedHabits({})).toEqual([]);
    expect(normalizeParsedHabits({ habits: 'nope' })).toEqual([]);
  });

  it('drops entries with empty/missing names and clamps long names', () => {
    const long = 'x'.repeat(150);
    const out = normalizeParsedHabits({
      habits: [{ name: '  ' }, { frequency: 'daily' }, { name: long, frequency: 'daily' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toHaveLength(100);
  });

  it('defaults frequency to daily when missing/blank', () => {
    const out = normalizeParsedHabits({
      habits: [{ name: 'Read' }, { name: 'Run', frequency: '' }],
    });
    expect(out.every((h) => h.frequency === 'daily')).toBe(true);
  });

  it('keeps only valid day ints 0-6, deduped and sorted; drops empty', () => {
    const out = normalizeParsedHabits({
      habits: [
        { name: 'A', frequency: 'weekly', days: [5, 1, 1, 7, -1, 3.5, 3] },
        { name: 'B', frequency: 'weekly', days: [9, 10] },
      ],
    });
    expect(out[0].days).toEqual([1, 3, 5]);
    expect(out[1].days).toBeUndefined();
  });

  it('keeps time only when valid HH:MM', () => {
    const out = normalizeParsedHabits({
      habits: [
        { name: 'A', frequency: 'daily', time: '08:30' },
        { name: 'B', frequency: 'daily', time: '25:00' },
        { name: 'C', frequency: 'daily', time: '8am' },
      ],
    });
    expect(out[0].time).toBe('08:30');
    expect(out[1].time).toBeUndefined();
    expect(out[2].time).toBeUndefined();
  });

  it('applies no count cap — returns all valid habits', () => {
    const habits = Array.from({ length: 25 }, (_, i) => ({ name: `H${i}`, frequency: 'daily' }));
    expect(normalizeParsedHabits({ habits })).toHaveLength(25);
  });
});
