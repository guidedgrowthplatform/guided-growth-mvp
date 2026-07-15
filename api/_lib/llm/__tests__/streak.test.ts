import { describe, expect, it } from 'vitest';

const { computeCurrentStreak, prevCalendarDay } = await import('../buildSystemPrompt.js');

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

describe('computeCurrentStreak', () => {
  const today = '2026-07-16';
  const set = (...days: string[]) => new Set(days);

  it('returns 0 for no completions', () => {
    expect(computeCurrentStreak(set(), today)).toBe(0);
  });
  it('returns 1 for only today', () => {
    expect(computeCurrentStreak(set(today), today)).toBe(1);
  });
  it('counts consecutive days ending today', () => {
    expect(computeCurrentStreak(set('2026-07-14', '2026-07-15', today), today)).toBe(3);
  });
  it('counts from yesterday when today is not yet done', () => {
    expect(computeCurrentStreak(set('2026-07-14', '2026-07-15'), today)).toBe(2);
  });
  it('returns 0 when neither today nor yesterday is done', () => {
    expect(computeCurrentStreak(set('2026-07-13', '2026-07-12'), today)).toBe(0);
  });
  it('stops at the first gap', () => {
    // today done, yesterday missing → streak is just today
    expect(computeCurrentStreak(set(today, '2026-07-14'), today)).toBe(1);
  });
  it('handles a positive-UTC-offset today string correctly (pure-string, tz-independent)', () => {
    // A Kiritimati (UTC+14) user whose "today" is already resolved to 2026-07-16.
    // The old noon-UTC bug returned 0 here; the pure helper returns 2.
    expect(computeCurrentStreak(set('2026-07-15', '2026-07-16'), '2026-07-16')).toBe(2);
  });
  it('counts a streak crossing a month boundary', () => {
    expect(computeCurrentStreak(set('2026-02-27', '2026-02-28', '2026-03-01'), '2026-03-01')).toBe(3);
  });
});
