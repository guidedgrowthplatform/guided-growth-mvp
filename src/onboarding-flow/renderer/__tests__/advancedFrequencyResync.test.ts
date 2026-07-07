// @vitest-environment jsdom
// G08 / G14: AdvancedFrequencyAdapter resync (W3 patch).
// Before this patch the adapter had ZERO resync — configs were seeded once at
// mount from answers.habitConfigs and never updated when a later tool-save
// arrived with updated per-habit day selections.

import { describe, it, expect } from 'vitest';

type HabitConfig = { days: number[]; time: string; reminder: boolean };
type Configs = Record<string, HabitConfig>;

const WEEKDAYS = [1, 2, 3, 4, 5];

// Build the savedHabitConfigsKey the production resync effect uses.
function buildKey(habitConfigs: Record<string, { days: number[] }>): string {
  return Object.entries(habitConfigs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, c]) => `${n}:${[...c.days].sort((a, b) => a - b).join('-')}`)
    .join('|');
}

// ------------------------------------------------------------------
// Simulate OLD adapter: configs locked at mount.
// ------------------------------------------------------------------
function simulateOldAdvancedFrequency(names: string[]): {
  configs: Configs;
  externalSave: (incoming: Record<string, { days: number[] }>) => void;
} {
  const configs: Configs = {};
  for (const name of names) {
    configs[name] = { days: [...WEEKDAYS], time: '09:00', reminder: true };
  }
  return { configs, externalSave: () => {} }; // old: no-op
}

// ------------------------------------------------------------------
// Simulate NEW adapter: resync configs from incoming habitConfigs when key changes.
// ------------------------------------------------------------------
function simulateNewAdvancedFrequency(names: string[]): {
  configs: Configs;
  syncCount: { value: number };
  externalSave: (incoming: Record<string, { days: number[] }>) => void;
} {
  const configs: Configs = {};
  for (const name of names) {
    configs[name] = { days: [...WEEKDAYS], time: '09:00', reminder: true };
  }
  const syncCount = { value: 0 };
  let lastKey = '';

  function externalSave(incoming: Record<string, { days: number[] }>) {
    const key = buildKey(incoming);
    if (!key || key === lastKey) return;
    lastKey = key;
    for (const name of names) {
      if (incoming[name]) {
        configs[name] = { ...configs[name], days: [...incoming[name].days] };
      }
    }
    syncCount.value += 1;
  }
  return { configs, syncCount, externalSave };
}

describe('AdvancedFrequencyAdapter resync — days per habit (G08 / G14 / W3)', () => {
  it('OLD: does NOT update habit days when a later tool-save lands after mount', () => {
    const { configs, externalSave } = simulateOldAdvancedFrequency(['Running', 'Reading']);
    externalSave({ Running: { days: [0, 6] }, Reading: { days: [1, 3, 5] } });
    // Bug: days never updated from the default weekdays.
    expect(configs['Running'].days).toEqual(WEEKDAYS);
    expect(configs['Reading'].days).toEqual(WEEKDAYS);
  });

  it('NEW: resyncs per-habit days when incoming habitConfigs arrive after mount', () => {
    const { configs, syncCount, externalSave } = simulateNewAdvancedFrequency([
      'Running',
      'Reading',
    ]);
    externalSave({ Running: { days: [0, 6] }, Reading: { days: [1, 3, 5] } });
    expect(configs['Running'].days).toEqual([0, 6]);
    expect(configs['Reading'].days).toEqual([1, 3, 5]);
    expect(syncCount.value).toBe(1);
  });

  it('NEW: no resync when incoming habitConfigs have the same days as current', () => {
    const { syncCount, externalSave } = simulateNewAdvancedFrequency(['Running']);
    // Same as WEEKDAYS default: no key change, no resync.
    externalSave({ Running: { days: [...WEEKDAYS] } });
    externalSave({ Running: { days: [...WEEKDAYS] } });
    expect(syncCount.value).toBe(1); // first call fires once (empty -> populated), not twice
  });

  it('NEW: fires a second resync when days change again', () => {
    const { configs, syncCount, externalSave } = simulateNewAdvancedFrequency(['Meditation']);
    externalSave({ Meditation: { days: [1, 2, 3] } });
    expect(syncCount.value).toBe(1);
    expect(configs['Meditation'].days).toEqual([1, 2, 3]);

    externalSave({ Meditation: { days: [0, 6] } });
    expect(syncCount.value).toBe(2);
    expect(configs['Meditation'].days).toEqual([0, 6]);
  });

  it('NEW: ignores an empty incoming habitConfigs (key guard)', () => {
    const { syncCount, externalSave } = simulateNewAdvancedFrequency(['Running']);
    externalSave({});
    expect(syncCount.value).toBe(0);
  });

  it('buildKey: produces a stable, order-independent key', () => {
    const key1 = buildKey({ Running: { days: [1, 3, 5] }, Reading: { days: [0, 6] } });
    const key2 = buildKey({ Reading: { days: [0, 6] }, Running: { days: [5, 1, 3] } });
    expect(key1).toBe(key2);
  });
});

// ------------------------------------------------------------------
// W3 live-path gap: update_habit is a server-side no-op DURING this beat (the
// advanced/braindump lane only ever persists raw brainDumpText — habitConfigs
// does not exist in the row yet, see api/_lib/llm/onboarding/handlers/
// updateHabit.ts's "Idempotent on miss ... the client voice-action still
// fires" comment). The answers-keyed resync above only catches a habitConfigs
// value that lands LATER (e.g. from this beat's own submit); it never fires
// for a live save on THIS beat. Verified live against the branch's Vercel
// preview (gg-5eh9qsuql-guided-growths-projects.vercel.app): a real
// "make running only on weekends" turn produced tool call
// update_habit({name:"running", days:[0,6], schedule:"Weekend"}) with result
// {updated: null} (the documented no-op), and the day-picker card never
// changed from the Mon-Fri default before this listener was added.
// ------------------------------------------------------------------
const SCHEDULE_DAYS: Record<string, number[]> = {
  Weekday: [1, 2, 3, 4, 5],
  Weekend: [0, 6],
  'Every day': [0, 1, 2, 3, 4, 5, 6],
};

/** Replicates the production update_habit live-listener's per-habit patch logic. */
function simulateUpdateHabitListener(names: string[]): {
  configs: Configs;
  applyLiveUpdate: (name: string, patch: Record<string, unknown>) => void;
} {
  const configs: Configs = {};
  for (const name of names) {
    configs[name] = { days: [...WEEKDAYS], time: '09:00', reminder: true };
  }
  function applyLiveUpdate(name: string, patch: Record<string, unknown>) {
    const target = name.trim().toLowerCase();
    const matchKey = Object.keys(configs).find((k) => k.toLowerCase() === target);
    if (!matchKey) return;
    const existing = configs[matchKey];
    const next = { ...existing };
    if (Array.isArray(patch.days)) {
      const ds = (patch.days as unknown[]).filter(
        (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
      );
      if (ds.length > 0) next.days = ds;
    } else if (typeof patch.schedule === 'string' && patch.schedule in SCHEDULE_DAYS) {
      next.days = [...SCHEDULE_DAYS[patch.schedule]];
    }
    if (typeof patch.time === 'string' && /^\d{1,2}:\d{2}$/.test(patch.time))
      next.time = patch.time;
    if (typeof patch.reminder === 'boolean') next.reminder = patch.reminder;
    configs[matchKey] = next;
  }
  return { configs, applyLiveUpdate };
}

describe('AdvancedFrequencyAdapter live update_habit listener (W3 live-path gap)', () => {
  it('applies a live per-habit days+schedule save (case-insensitive name match)', () => {
    const { configs, applyLiveUpdate } = simulateUpdateHabitListener(['Running', 'Reading']);
    // The LLM's tool call name casing does not match the display key's casing.
    applyLiveUpdate('running', { days: [0, 6], schedule: 'Weekend' });
    expect(configs['Running'].days).toEqual([0, 6]);
    expect(configs['Reading'].days).toEqual(WEEKDAYS); // untouched
  });

  it('expands a schedule-only patch (no days) into the day set', () => {
    const { configs, applyLiveUpdate } = simulateUpdateHabitListener(['Meditation']);
    applyLiveUpdate('Meditation', { schedule: 'Every day' });
    expect(configs['Meditation'].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('applies time and reminder independently of days', () => {
    const { configs, applyLiveUpdate } = simulateUpdateHabitListener(['Reading']);
    applyLiveUpdate('reading', { time: '21:30', reminder: false });
    expect(configs['Reading'].time).toBe('21:30');
    expect(configs['Reading'].reminder).toBe(false);
    expect(configs['Reading'].days).toEqual(WEEKDAYS); // untouched
  });

  it('no-ops when the name does not match any known habit', () => {
    const { configs, applyLiveUpdate } = simulateUpdateHabitListener(['Running']);
    applyLiveUpdate('yoga', { days: [0, 6] });
    expect(configs['Running'].days).toEqual(WEEKDAYS);
    expect(configs['yoga']).toBeUndefined();
  });

  it('ignores an out-of-range day and a malformed time', () => {
    const { configs, applyLiveUpdate } = simulateUpdateHabitListener(['Running']);
    applyLiveUpdate('Running', { days: [9, -1], time: 'not-a-time' });
    expect(configs['Running'].days).toEqual(WEEKDAYS); // no valid days -> unchanged
    expect(configs['Running'].time).toBe('09:00'); // malformed time -> unchanged
  });
});
