/**
 * Pure-helper test for the reconciliation logic mirrored from
 * HabitCustomizeSheet (and Step6Page). The full component renders React +
 * routes which would need jsdom; the logic that actually matters here is
 * the inferSchedule + SCHEDULE_DAYS dance, which is pure.
 *
 * Regression target (Mint round-2): picking the "Weekday" chip then
 * opening the day picker and toggling Mon/Wed/Fri used to persist
 * `{schedule:'Weekday', days:[1,3,5]}`. With the new reconciliation,
 * toggling re-infers schedule from days, so the persisted shape is
 * `{schedule:'Weekday' (fallback, since [1,3,5] is custom), days:[1,3,5]}`
 * and PlanReviewPage renders "3 days/week" via formatCadence(days).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { inferSchedule, SCHEDULE_DAYS, toggleSetItem } from './constants';
import type { ScheduleOption } from './SchedulePicker';

// Replays the state transitions HabitCustomizeSheet / Step6Page perform.
function simulate(initialSchedule: ScheduleOption) {
  let schedule: ScheduleOption = initialSchedule;
  let days = new Set(SCHEDULE_DAYS[initialSchedule]);

  function pickChip(value: ScheduleOption) {
    schedule = value;
    days = new Set(SCHEDULE_DAYS[value]);
  }

  function toggleDay(day: number) {
    days = toggleSetItem(days, day);
    schedule = inferSchedule(days) ?? 'Weekday';
  }

  return {
    get state() {
      return { schedule, days: [...days].sort((a, b) => a - b) };
    },
    pickChip,
    toggleDay,
  };
}

describe('HabitCustomizeSheet reconciliation', () => {
  it('picking Weekday narrows days to Mon-Fri', () => {
    const s = simulate('Weekday');
    s.pickChip('Weekday');
    expect(s.state).toEqual({ schedule: 'Weekday', days: [1, 2, 3, 4, 5] });
  });

  it('picking Every day expands days to all 7', () => {
    const s = simulate('Weekday');
    s.pickChip('Every day');
    expect(s.state).toEqual({ schedule: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] });
  });

  it('Mint scenario: pick Weekday then toggle to Mon/Wed/Fri — schedule becomes a fallback label, days reflect reality', () => {
    const s = simulate('Weekday');
    // Already on [1,2,3,4,5] (Weekday preset).
    s.toggleDay(2); // off Tue → [1,3,4,5]
    s.toggleDay(4); // off Thu → [1,3,5]
    expect(s.state.days).toEqual([1, 3, 5]);
    // Custom combination → inferSchedule returns null → falls back to 'Weekday' label.
    // The key property is that days drives the cadence; formatCadence([1,3,5])
    // is "3 days/week" regardless of the schedule label.
    expect(s.state.schedule).toBe('Weekday');
  });

  it('toggling to weekend-only days re-infers schedule to Weekend', () => {
    const s = simulate('Weekday');
    // Clear weekdays.
    [1, 2, 3, 4, 5].forEach((d) => s.toggleDay(d));
    // Add weekend.
    s.toggleDay(0);
    s.toggleDay(6);
    expect(s.state).toEqual({ schedule: 'Weekend', days: [0, 6] });
  });

  it('toggling all 7 days on re-infers schedule to Every day', () => {
    const s = simulate('Weekday');
    s.toggleDay(0);
    s.toggleDay(6);
    expect(s.state).toEqual({ schedule: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] });
  });
});
