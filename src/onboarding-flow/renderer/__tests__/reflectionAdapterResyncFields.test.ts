// @vitest-environment jsdom
// G08 / G14: ReflectionAdapter resync for time, reminder, schedule, mode, prompts (W3 patch).
// B53 already covers the days field. These simulate the new per-field resync effects
// using the same state-machine pattern as weeklyDayPickerResync.test.ts.

import { describe, it, expect } from 'vitest';

interface ReflectionState {
  time: string;
  reminder: boolean;
  schedule: string;
  mode: string;
  prompts: string[];
  syncCounts: Record<string, number>;
}

function simulateOldReflectionAdapter(mount: {
  time: string;
  reminder: boolean;
  schedule: string;
  mode: string;
  prompts: string[];
}): { state: ReflectionState; externalSave: (u: Partial<Omit<ReflectionState, 'syncCounts'>>) => void } {
  const state: ReflectionState = {
    ...mount,
    syncCounts: { time: 0, reminder: 0, schedule: 0, mode: 0, prompts: 0 },
  };
  return { state, externalSave: () => {} };
}

function simulateNewReflectionAdapter(mount: {
  time: string;
  reminder: boolean;
  schedule: string;
  mode: string;
  prompts: string[];
}): { state: ReflectionState; externalSave: (u: Partial<Omit<ReflectionState, 'syncCounts'>>) => void } {
  const state: ReflectionState = {
    ...mount,
    prompts: [...mount.prompts],
    syncCounts: { time: 0, reminder: 0, schedule: 0, mode: 0, prompts: 0 },
  };
  let lastTime = mount.time;
  let lastReminder = mount.reminder;
  let lastSchedule = mount.schedule;
  let lastMode = mount.mode;
  let lastPromptsKey = mount.prompts.join('\x00');

  function externalSave(update: Partial<Omit<ReflectionState, 'syncCounts'>>) {
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
    if (update.mode !== undefined && update.mode !== lastMode) {
      lastMode = update.mode;
      state.mode = update.mode;
      state.syncCounts.mode += 1;
    }
    if (update.prompts !== undefined) {
      const key = update.prompts.join('\x00');
      if (key !== lastPromptsKey) {
        lastPromptsKey = key;
        state.prompts = [...update.prompts];
        state.syncCounts.prompts += 1;
      }
    }
  }
  return { state, externalSave };
}

describe('ReflectionAdapter resync — time field (G14 / W3)', () => {
  const base = { time: '21:45', reminder: true, schedule: 'Weekday', mode: 'prompts', prompts: [] };

  it('OLD: does NOT update time when a later save lands after mount', () => {
    const { state, externalSave } = simulateOldReflectionAdapter(base);
    externalSave({ time: '22:30' });
    expect(state.time).toBe('21:45');
    expect(state.syncCounts.time).toBe(0);
  });

  it('NEW: resyncs time when a later save lands with a different value', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ time: '22:30' });
    expect(state.time).toBe('22:30');
    expect(state.syncCounts.time).toBe(1);
  });

  it('NEW: no resync when time is unchanged', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ time: '21:45' });
    expect(state.syncCounts.time).toBe(0);
  });
});

describe('ReflectionAdapter resync — reminder field (G14 / W3)', () => {
  const base = { time: '21:45', reminder: true, schedule: 'Weekday', mode: 'prompts', prompts: [] };

  it('OLD: does NOT update reminder when a later save lands after mount', () => {
    const { state, externalSave } = simulateOldReflectionAdapter(base);
    externalSave({ reminder: false });
    expect(state.reminder).toBe(true);
    expect(state.syncCounts.reminder).toBe(0);
  });

  it('NEW: resyncs reminder when a later save flips it', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ reminder: false });
    expect(state.reminder).toBe(false);
    expect(state.syncCounts.reminder).toBe(1);
  });
});

describe('ReflectionAdapter resync — schedule field (G14 / W3)', () => {
  const base = { time: '21:45', reminder: true, schedule: 'Weekday', mode: 'prompts', prompts: [] };

  it('OLD: does NOT update schedule when a later save lands after mount', () => {
    const { state, externalSave } = simulateOldReflectionAdapter(base);
    externalSave({ schedule: 'Every day' });
    expect(state.schedule).toBe('Weekday');
    expect(state.syncCounts.schedule).toBe(0);
  });

  it('NEW: resyncs schedule when a later save changes it', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ schedule: 'Every day' });
    expect(state.schedule).toBe('Every day');
    expect(state.syncCounts.schedule).toBe(1);
  });
});

describe('ReflectionAdapter resync — mode field (G14 / W3)', () => {
  const base = { time: '21:45', reminder: true, schedule: 'Weekday', mode: 'prompts', prompts: [] };

  it('OLD: does NOT update mode when a later save lands after mount', () => {
    const { state, externalSave } = simulateOldReflectionAdapter(base);
    externalSave({ mode: 'freeform' });
    expect(state.mode).toBe('prompts');
    expect(state.syncCounts.mode).toBe(0);
  });

  it('NEW: resyncs mode when a later save changes it', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ mode: 'freeform' });
    expect(state.mode).toBe('freeform');
    expect(state.syncCounts.mode).toBe(1);
  });

  it('NEW: no resync when mode is unchanged', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ mode: 'prompts' });
    expect(state.syncCounts.mode).toBe(0);
  });
});

describe('ReflectionAdapter resync — prompts field (G14 / W3)', () => {
  const base = { time: '21:45', reminder: true, schedule: 'Weekday', mode: 'prompts', prompts: [] };

  it('OLD: does NOT update prompts when a later save lands after mount', () => {
    const { state, externalSave } = simulateOldReflectionAdapter(base);
    externalSave({ prompts: ['What went well?', 'What challenged you?'] });
    expect(state.prompts).toEqual([]);
    expect(state.syncCounts.prompts).toBe(0);
  });

  it('NEW: resyncs prompts when a later save adds them', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({ prompts: ['What went well?', 'What challenged you?'] });
    expect(state.prompts).toEqual(['What went well?', 'What challenged you?']);
    expect(state.syncCounts.prompts).toBe(1);
  });

  it('NEW: no resync when prompts are unchanged (same content)', () => {
    const { state, externalSave } = simulateNewReflectionAdapter({
      ...base,
      prompts: ['What went well?'],
    });
    externalSave({ prompts: ['What went well?'] });
    expect(state.syncCounts.prompts).toBe(0);
  });

  it('NEW: all five fields fire independent resyncs in one save', () => {
    const { state, externalSave } = simulateNewReflectionAdapter(base);
    externalSave({
      time: '22:00',
      reminder: false,
      schedule: 'Weekend',
      mode: 'freeform',
      prompts: ['How do you feel?'],
    });
    expect(state.time).toBe('22:00');
    expect(state.reminder).toBe(false);
    expect(state.schedule).toBe('Weekend');
    expect(state.mode).toBe('freeform');
    expect(state.prompts).toEqual(['How do you feel?']);
    expect(state.syncCounts.time).toBe(1);
    expect(state.syncCounts.reminder).toBe(1);
    expect(state.syncCounts.schedule).toBe(1);
    expect(state.syncCounts.mode).toBe(1);
    expect(state.syncCounts.prompts).toBe(1);
  });
});
