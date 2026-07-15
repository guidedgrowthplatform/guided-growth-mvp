import { describe, expect, it } from 'vitest';

const { streakEndingAt, prevCalendarDay, formatStreakLine } = await import(
  '../buildSystemPrompt.js'
);

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

// Rule 7: a rest day BRIDGES the run — it does not break the streak, and it does
// not count as a win (the number stays done-days only).
describe('streakEndingAt with rest bridging', () => {
  const set = (...days: string[]) => new Set(days);
  const yesterday = '2026-07-15';

  it('bridges a rest between two done days (does not break, does not count)', () => {
    // done 13, rest 14, done 15 → 2 done days, rest bridged
    expect(streakEndingAt(set('2026-07-13', yesterday), yesterday, set('2026-07-14'))).toBe(2);
  });
  it('protects the run when the anchor itself is a rest', () => {
    // rest 15 (anchor), done 14, done 13 → run of 2 done days still counts
    expect(streakEndingAt(set('2026-07-13', '2026-07-14'), yesterday, set(yesterday))).toBe(2);
  });
  it('bridges multiple consecutive rest days', () => {
    // done 12, rest 13, rest 14, done 15 → 2 done days
    expect(streakEndingAt(set('2026-07-12', yesterday), yesterday, set('2026-07-13', '2026-07-14'))).toBe(2);
  });
  it('returns 0 when the run is only rests (no win to count)', () => {
    expect(streakEndingAt(set(), yesterday, set('2026-07-13', '2026-07-14', yesterday))).toBe(0);
  });
  it('still stops at a real gap below a bridged rest (missed, not rest)', () => {
    // done 15, rest 14, then 13 absent (a miss/pending, not a rest) → stop after bridging
    expect(streakEndingAt(set(yesterday), yesterday, set('2026-07-14'))).toBe(1);
  });
  it('is backward-compatible: omitting restDays behaves like the done-only version', () => {
    expect(streakEndingAt(set('2026-07-14', yesterday), yesterday)).toBe(2);
  });
});

// The streak block reports the run THROUGH YESTERDAY plus a hypothetical
// "(N+1 including today)". That hypothetical must NOT show when today is already a
// rest, or it over-claims a rest as a win (and diverges from the client streak).
describe('formatStreakLine', () => {
  it('shows the +1-including-today hypothetical when today is not a rest', () => {
    const line = formatStreakLine('Gym', 2, false);
    expect(line).toContain('2 in a row through yesterday');
    expect(line).toContain('(3 including today)');
  });
  it('suppresses the +1 and states the protected number when today is a rest', () => {
    const line = formatStreakLine('Gym', 2, true);
    expect(line).not.toContain('including today');
    expect(line).not.toContain('(3');
    expect(line).toContain("protected through today's rest");
    expect(line).toContain('stays 2');
  });
  it('trims/collapses whitespace in the habit name', () => {
    expect(formatStreakLine('  no   news  ', 4, false)).toContain('- no news: 4 in a row');
  });
});
