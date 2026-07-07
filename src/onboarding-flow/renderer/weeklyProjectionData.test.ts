/**
 * A2: the five projection frames' grid math, locked to the render's behavior
 * (beats/weeklyProjection.tsx, Yair 2026-07-05): start-day week rotation,
 * weekday-only rituals, per-frame percentages, the gaps frame's Tue/Wed/Thu
 * empty top to bottom, and the reported-only header percent.
 */
import { describe, expect, it } from 'vitest';
import {
  buildProjectionRows,
  COACH_HABITS,
  dayLabelsFrom,
  dayOrderFrom,
  projectionHabits,
  projectionStats,
  SAMPLE_USER_HABITS,
  trailingStreak,
} from './weeklyProjectionData';

const HABITS = [...COACH_HABITS, ...SAMPLE_USER_HABITS];
const WEEKEND = new Set([0, 6]);

describe('dayOrderFrom / dayLabelsFrom (the week starts on the start day)', () => {
  it('rotates the week to begin on the start weekday', () => {
    expect(dayOrderFrom(3)).toEqual([3, 4, 5, 6, 0, 1, 2]);
    expect(dayLabelsFrom(3)).toEqual(['W', 'T', 'F', 'S', 'S', 'M', 'T']);
    expect(dayOrderFrom(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('buildProjectionRows', () => {
  it('blank: every scheduled day empty (gap), rituals off on weekends', () => {
    const rows = buildProjectionRows(HABITS, 'blank', dayOrderFrom(1));
    for (const row of rows.slice(0, 3)) {
      row.cells.forEach((cell, ci) => {
        const wd = dayOrderFrom(1)[ci];
        expect(cell, `${row.name} col ${ci}`).toBe(WEEKEND.has(wd) ? 'off' : 'gap');
      });
      expect(row.done).toBe(0);
    }
    expect(projectionStats(rows).percent).toBe(0);
  });

  it('full: every scheduled day done, big accumulated streaks', () => {
    const rows = buildProjectionRows(HABITS, 'full', dayOrderFrom(2));
    expect(projectionStats(rows).percent).toBe(100);
    expect(rows[0].streak).toBe(84);
    // Weekday-only ritual: exactly 5 done, 2 off.
    expect(rows[0].cells.filter((c) => c === 'done')).toHaveLength(5);
    expect(rows[0].cells.filter((c) => c === 'off')).toHaveLength(2);
  });

  it('p78: mostly green, percent near the target, exactly one streak broken', () => {
    const rows = buildProjectionRows(HABITS, 'p78', dayOrderFrom(5));
    const pct = projectionStats(rows).percent;
    expect(pct).toBeGreaterThanOrEqual(70);
    expect(pct).toBeLessThanOrEqual(82);
    // Meditate (index 3) is the broken streak: its last scheduled day missed.
    expect(trailingStreak(rows[3].cells)).toBe(0);
    // Realistic frames show the small this-week run, not the accumulated base.
    expect(rows[0].streak).toBeLessThanOrEqual(7);
  });

  it('p36: tough week, hero morning check-in survives, reflection keeps a tail', () => {
    const rows = buildProjectionRows(HABITS, 'p36', dayOrderFrom(0));
    const pct = projectionStats(rows).percent;
    expect(pct).toBeGreaterThanOrEqual(30);
    expect(pct).toBeLessThanOrEqual(42);
    // Hero: every scheduled day done.
    rows[0].cells.forEach((cell) => expect(cell === 'done' || cell === 'off').toBe(true));
    // Daily reflection ends on a small surviving streak.
    expect(trailingStreak(rows[2].cells)).toBeGreaterThanOrEqual(2);
  });

  it('gaps: Tuesday, Wednesday, Thursday empty top to bottom', () => {
    const order = dayOrderFrom(4);
    const rows = buildProjectionRows(HABITS, 'gaps', order);
    for (const row of rows) {
      row.cells.forEach((cell, ci) => {
        if ([2, 3, 4].includes(order[ci])) {
          expect(cell, `${row.name} weekday ${order[ci]}`).toBe('gap');
        }
      });
    }
    // Gaps do not drag the header percent: it counts reported days only.
    const stats = projectionStats(rows);
    const reportedCells = rows
      .flatMap((r) => r.cells)
      .filter((c) => c === 'done' || c === 'missed');
    expect(stats.reported).toBe(reportedCells.length);
  });

  it('frames are deterministic across calls', () => {
    const a = buildProjectionRows(HABITS, 'p78', dayOrderFrom(5));
    const b = buildProjectionRows(HABITS, 'p78', dayOrderFrom(5));
    expect(a).toEqual(b);
  });
});

describe('projectionHabits', () => {
  it('uses the real captured habits when the flow has them', () => {
    const habits = projectionHabits({
      'Evening walk': { days: [1, 3, 5] },
      Stretch: { days: new Set([2, 4]) },
    });
    expect(habits.map((h) => h.name)).toEqual([
      ...COACH_HABITS.map((h) => h.name),
      'Evening walk',
      'Stretch',
    ]);
    expect(habits[3].days).toEqual([1, 3, 5]);
    expect(habits[4].days).toEqual([2, 4]);
  });

  it('falls back to the sample set when nothing is captured', () => {
    expect(projectionHabits(null).map((h) => h.name)).toEqual([
      ...COACH_HABITS.map((h) => h.name),
      ...SAMPLE_USER_HABITS.map((h) => h.name),
    ]);
  });

  // W3-B: server truth only. The morning ritual row must not render unless
  // submit_morning_checkin actually saved (a refusal must leave no trace).
  it('drops the morning ritual row when morning check-in was not configured', () => {
    const habits = projectionHabits(null, false);
    expect(habits.map((h) => h.name)).not.toContain('Morning state check-in');
    expect(habits.map((h) => h.name)).toEqual([
      'Evening habit report',
      'Daily reflection',
      ...SAMPLE_USER_HABITS.map((h) => h.name),
    ]);
  });

  it('keeps the morning ritual row when morning check-in was configured', () => {
    const habits = projectionHabits(null, true);
    expect(habits.map((h) => h.name)).toContain('Morning state check-in');
  });

  it('defaults to including the morning ritual row (back-compat for existing callers)', () => {
    const habits = projectionHabits(null);
    expect(habits.map((h) => h.name)).toEqual([
      ...COACH_HABITS.map((h) => h.name),
      ...SAMPLE_USER_HABITS.map((h) => h.name),
    ]);
  });

  it('drops only the morning row, leaving real captured habits and other rituals intact', () => {
    const habits = projectionHabits({ 'Evening walk': { days: [1, 3, 5] } }, false);
    expect(habits.map((h) => h.name)).toEqual([
      'Evening habit report',
      'Daily reflection',
      'Evening walk',
    ]);
  });
});
