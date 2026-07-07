// @vitest-environment jsdom
// G08 / G14: ScheduleCard resync for time, reminder, schedule fields (W3 patch).
// B53 already covers the days field. These tests exercise the resync-key logic
// for the remaining three fields — same pattern as weeklyDayPickerResync.test.ts.

import { describe, it, expect } from 'vitest';

// ------------------------------------------------------------------
// Simulate the OLD adapter: all fields locked at mount.
// ------------------------------------------------------------------
function simulateOldScheduleCard(mount: {
  time: string;
  reminder: boolean;
  schedule: string;
}) {
  const state = { ...mount, syncCounts: { time: 0, reminder: 0, schedule: 0 } };
  function externalSave(_update: Partial<{ time: string; reminder: boolean; schedule: string }>) {
    // old: no-op on prop updates
  }
  return { state, externalSave };
}

// ------------------------------------------------------------------
// Simulate the NEW adapter: each field has an independent resync ref+effect.
// ------------------------------------------------------------------
function simulateNewScheduleCard(mount: {
  time: string;
  reminder: boolean;
  schedule: string;
}) {
  const state = { ...mount, syncCounts: { time: 0, reminder: 0, schedule: 0 } };
  let lastTime = mount.time;
  let lastReminder = mount.reminder;
  let lastSchedule = mount.schedule;

  function externalSave(update: Partial<{ time: string; reminder: boolean; schedule: string }>) {
    if (update.time !== undefined && update.time !== lastTime) {
      lastTime = update.time;
      state.time = update.time;
      state.syncCounts.time += 1;
    }
    if (update.reminder !== undefined && update.reminder !== lastReminder) {
      lastReminder = update.reminder;
      state.reminder = update.reminder;
      state.syncCounts.reminder += 1;
    }
    if (update.schedule !== undefined && update.schedule !== lastSchedule) {
      lastSchedule = update.schedule;
      state.schedule = update.schedule;
      state.syncCounts.schedule += 1;
    }
  }
  return { state, externalSave };
}

describe('ScheduleCard resync — time field (G14 / W3)', () => {
  it('OLD: does NOT update time when a later tool-save lands after mount', () => {
    const { state, externalSave } = simulateOldScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ time: '07:00' });
    expect(state.time).toBe('09:00');
    expect(state.syncCounts.time).toBe(0);
  });

  it('NEW: resyncs time when a later save lands with a different value', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ time: '07:00' });
    expect(state.time).toBe('07:00');
    expect(state.syncCounts.time).toBe(1);
  });

  it('NEW: no resync when time is the same', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ time: '09:00' });
    expect(state.syncCounts.time).toBe(0);
  });

  it('NEW: fires resync for each distinct time value', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ time: '07:00' });
    externalSave({ time: '08:30' });
    expect(state.time).toBe('08:30');
    expect(state.syncCounts.time).toBe(2);
  });
});

describe('ScheduleCard resync — reminder field (G14 / W3)', () => {
  it('OLD: does NOT update reminder when a later tool-save lands after mount', () => {
    const { state, externalSave } = simulateOldScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ reminder: false });
    expect(state.reminder).toBe(true);
    expect(state.syncCounts.reminder).toBe(0);
  });

  it('NEW: resyncs reminder when a later save flips it', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ reminder: false });
    expect(state.reminder).toBe(false);
    expect(state.syncCounts.reminder).toBe(1);
  });

  it('NEW: no resync when reminder is unchanged', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ reminder: true });
    expect(state.syncCounts.reminder).toBe(0);
  });
});

describe('ScheduleCard resync — schedule field (G14 / W3)', () => {
  it('OLD: does NOT update schedule when a later tool-save lands after mount', () => {
    const { state, externalSave } = simulateOldScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ schedule: 'Every day' });
    expect(state.schedule).toBe('Weekday');
    expect(state.syncCounts.schedule).toBe(0);
  });

  it('NEW: resyncs schedule when a later save changes it', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ schedule: 'Every day' });
    expect(state.schedule).toBe('Every day');
    expect(state.syncCounts.schedule).toBe(1);
  });

  it('NEW: no resync when schedule is unchanged', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ schedule: 'Weekday' });
    expect(state.syncCounts.schedule).toBe(0);
  });

  it('NEW: independent resync — time, reminder, and schedule each fire once', () => {
    const { state, externalSave } = simulateNewScheduleCard({ time: '09:00', reminder: true, schedule: 'Weekday' });
    externalSave({ time: '07:00', reminder: false, schedule: 'Every day' });
    expect(state.time).toBe('07:00');
    expect(state.reminder).toBe(false);
    expect(state.schedule).toBe('Every day');
    expect(state.syncCounts.time).toBe(1);
    expect(state.syncCounts.reminder).toBe(1);
    expect(state.syncCounts.schedule).toBe(1);
  });
});
