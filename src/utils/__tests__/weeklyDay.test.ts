import { describe, expect, it } from 'vitest';
import { recommendedWeekdayPreset, recommendedWeeklyDay } from '../weeklyDay';

describe('recommendedWeeklyDay', () => {
  it('recommends Saturday night (6) for Israel (Sunday-start work week)', () => {
    expect(recommendedWeeklyDay('Asia/Jerusalem')).toBe(6);
  });

  it('recommends Sunday night (0) for Monday-start regions', () => {
    expect(recommendedWeeklyDay('America/New_York')).toBe(0);
    expect(recommendedWeeklyDay('Europe/London')).toBe(0);
    expect(recommendedWeeklyDay('America/Bogota')).toBe(0);
    expect(recommendedWeeklyDay('Asia/Tokyo')).toBe(0);
  });

  it('defaults unknown zones to Sunday night (0)', () => {
    expect(recommendedWeeklyDay('Not/AZone')).toBe(0);
  });
});

describe('recommendedWeekdayPreset (B49)', () => {
  it('defaults to Sun-Thu (0-4) for Israel', () => {
    expect([...recommendedWeekdayPreset('Asia/Jerusalem')].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('defaults to Mon-Fri (1-5) for Monday-start regions', () => {
    expect([...recommendedWeekdayPreset('America/New_York')].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([...recommendedWeekdayPreset('Europe/London')].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([...recommendedWeekdayPreset('America/Bogota')].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([...recommendedWeekdayPreset('Asia/Tokyo')].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('defaults unknown zones to Mon-Fri (1-5)', () => {
    expect([...recommendedWeekdayPreset('Not/AZone')].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
