import { describe, expect, it } from 'vitest';
import { calcHabitStreaks, prevDayStr } from './habitStreak';

describe('prevDayStr', () => {
  it('steps back one calendar day, crossing month/year and DST', () => {
    expect(prevDayStr('2026-07-16')).toBe('2026-07-15');
    expect(prevDayStr('2026-03-01')).toBe('2026-02-28');
    expect(prevDayStr('2026-01-01')).toBe('2025-12-31');
    expect(prevDayStr('2026-03-09')).toBe('2026-03-08'); // US spring-forward
  });
});

describe('calcHabitStreaks', () => {
  const today = '2026-07-16';

  it('is 0 with no done days (even if there are rests)', () => {
    expect(calcHabitStreaks([], [], today)).toEqual({ current: 0, longest: 0 });
    expect(calcHabitStreaks([], ['2026-07-15', '2026-07-16'], today)).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it('counts a plain consecutive run through today', () => {
    expect(calcHabitStreaks(['2026-07-14', '2026-07-15', '2026-07-16'], [], today)).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it('keeps the current streak alive when only yesterday is done (not today yet)', () => {
    expect(calcHabitStreaks(['2026-07-14', '2026-07-15'], [], today)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('breaks when both today and yesterday are unmarked', () => {
    expect(calcHabitStreaks(['2026-07-13', '2026-07-14'], [], today).current).toBe(0);
  });

  it('bridges a rest between done days (does not break, does not count)', () => {
    // done 14, rest 15, done 16(today) → current 2, longest 2
    expect(calcHabitStreaks(['2026-07-14', '2026-07-16'], ['2026-07-15'], today)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('protects the current streak when today itself is a rest', () => {
    // done 14, 15; rest 16(today) → streak of 2 still current
    expect(calcHabitStreaks(['2026-07-14', '2026-07-15'], ['2026-07-16'], today)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('protects across a rest yesterday even when today is still pending', () => {
    // done 13, 14; rest 15(yesterday); today pending → current 2
    expect(calcHabitStreaks(['2026-07-13', '2026-07-14'], ['2026-07-15'], today).current).toBe(2);
  });

  it('bridges multiple consecutive rests', () => {
    // done 13, rest 14, rest 15, done 16 → current 2
    expect(
      calcHabitStreaks(['2026-07-13', '2026-07-16'], ['2026-07-14', '2026-07-15'], today),
    ).toEqual({ current: 2, longest: 2 });
  });

  it('longest ignores trailing rests after the last done day', () => {
    // done 10-12 (run of 3), then rest 13, rest 14, nothing since
    expect(
      calcHabitStreaks(
        ['2026-07-10', '2026-07-11', '2026-07-12'],
        ['2026-07-13', '2026-07-14'],
        today,
      ),
    ).toEqual({ current: 0, longest: 3 });
  });

  it('a real miss (unmarked gap) still breaks, a rest does not', () => {
    // done 16(today), 15 rest, then 14 unmarked (a miss) → current stops at 1
    expect(calcHabitStreaks(['2026-07-16'], ['2026-07-15'], today).current).toBe(1);
  });
});
