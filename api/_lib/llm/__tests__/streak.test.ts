import { describe, expect, it } from 'vitest';

const { streakEndingAt, prevCalendarDay } = await import('../buildSystemPrompt.js');

describe('prevCalendarDay', () => {
  it('steps back one calendar day', () => {
    expect(prevCalendarDay('2026-07-16')).toBe('2026-07-15');
  });
  it('crosses month boundaries', () => {
    expect(prevCalendarDay('2026-03-01')).toBe('2026-02-28');
    expect(prevCalendarDay('2026-01-01')).toBe('2025-12-31');
  });
  it('is DST-agnostic (pure calendar math)', () => {
    // US DST spring-forward is 2026-03-08; the predecessor is still the plain prior day.
    expect(prevCalendarDay('2026-03-09')).toBe('2026-03-08');
    expect(prevCalendarDay('2026-03-08')).toBe('2026-03-07');
  });
});

// streakEndingAt counts consecutive 'done' days ending EXACTLY at the anchor day.
// The streak block passes YESTERDAY as the anchor (the run "through yesterday"), and
// the coach adds today only when the user confirms they did the habit today.
describe('streakEndingAt', () => {
  const set = (...days: string[]) => new Set(days);
  const yesterday = '2026-07-15';

  it('returns 0 when the anchor day itself is not done', () => {
    expect(streakEndingAt(set('2026-07-13', '2026-07-14'), yesterday)).toBe(0);
    expect(streakEndingAt(set(), yesterday)).toBe(0);
  });
  it('returns 1 when only the anchor day is done', () => {
    expect(streakEndingAt(set(yesterday), yesterday)).toBe(1);
  });
  it('counts consecutive days ending at the anchor', () => {
    expect(streakEndingAt(set('2026-07-13', '2026-07-14', yesterday), yesterday)).toBe(3);
  });
  it('stops at the first gap below the anchor', () => {
    // yesterday + day-before-yesterday missing → run is just the anchor
    expect(streakEndingAt(set(yesterday, '2026-07-13'), yesterday)).toBe(1);
  });
  it('ignores completions after the anchor (today is added by the coach, not here)', () => {
    // today (07-16) done should NOT extend the through-yesterday count
    expect(streakEndingAt(set('2026-07-14', yesterday, '2026-07-16'), yesterday)).toBe(2);
  });
  it('counts a run crossing a month boundary', () => {
    expect(streakEndingAt(set('2026-02-27', '2026-02-28'), '2026-02-28')).toBe(2);
    expect(streakEndingAt(set('2025-12-31', '2026-01-01'), '2026-01-01')).toBe(2);
  });
  it('is tz-independent (pure string), so a positive-offset anchor works', () => {
    // A Kiritimati (UTC+14) user whose resolved yesterday is 2026-07-15.
    expect(streakEndingAt(set('2026-07-14', '2026-07-15'), '2026-07-15')).toBe(2);
  });
});
