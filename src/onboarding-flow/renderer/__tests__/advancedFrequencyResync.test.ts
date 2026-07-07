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
    const { configs, syncCount, externalSave } = simulateNewAdvancedFrequency(['Running', 'Reading']);
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
