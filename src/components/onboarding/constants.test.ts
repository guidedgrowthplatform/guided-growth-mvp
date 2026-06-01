/**
 * Unit tests for the cadence + schedule helpers.
 *
 * Regression target (GitLab #196 + Mint round-2 review): HabitCustomizeSheet
 * used to persist `{days, schedule}` independently (e.g. picking the
 * "Weekday" chip then opening the day picker and choosing Mon/Wed/Fri left
 * `{schedule:'Weekday', days:[1,3,5]}`). inferSchedule + SCHEDULE_DAYS let
 * the form keep both fields reconciled — toggling a day re-infers the chip,
 * picking a chip narrows days — so PlanReviewPage can read
 * formatCadence(days) alone and get a faithful label.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_DAYS,
  formatCadence,
  inferSchedule,
  SCHEDULE_DAYS,
  WEEKDAYS,
  WEEKEND,
} from './constants';

describe('inferSchedule', () => {
  it('matches the Weekday preset (Mon-Fri)', () => {
    expect(inferSchedule(new Set([1, 2, 3, 4, 5]))).toBe('Weekday');
  });

  it('matches the Weekend preset (Sat+Sun)', () => {
    expect(inferSchedule(new Set([0, 6]))).toBe('Weekend');
  });

  it('matches the Every day preset (all 7)', () => {
    expect(inferSchedule(new Set([0, 1, 2, 3, 4, 5, 6]))).toBe('Every day');
  });

  it('returns null for a custom combination (Mon/Wed/Fri)', () => {
    expect(inferSchedule(new Set([1, 3, 5]))).toBeNull();
  });

  it('returns null for an empty set', () => {
    expect(inferSchedule(new Set())).toBeNull();
  });

  it('returns null for an unrelated single day (just Tuesday)', () => {
    expect(inferSchedule(new Set([2]))).toBeNull();
  });

  it('agrees with formatCadence on every preset (round-trip)', () => {
    // The cadence string seen by the user must be derivable from days alone
    // once schedule is kept in sync, which is the whole point of this helper.
    expect(formatCadence(SCHEDULE_DAYS.Weekday)).toBe('Weekdays');
    expect(formatCadence(SCHEDULE_DAYS.Weekend)).toBe('Weekends');
    expect(formatCadence(SCHEDULE_DAYS['Every day'])).toBe('Daily');
  });
});

describe('SCHEDULE_DAYS', () => {
  it('Weekday preset equals WEEKDAYS', () => {
    expect(SCHEDULE_DAYS.Weekday).toBe(WEEKDAYS);
  });
  it('Weekend preset equals WEEKEND', () => {
    expect(SCHEDULE_DAYS.Weekend).toBe(WEEKEND);
  });
  it('Every day preset equals ALL_DAYS', () => {
    expect(SCHEDULE_DAYS['Every day']).toBe(ALL_DAYS);
  });
});
