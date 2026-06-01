/**
 * Tests for deriveStateFromOnboarding — the fallback that rebuilds
 * PlanReviewState from onboarding_states.data when the user reaches
 * step-7 via agent-driven navigation (which doesn't populate
 * React Router location.state).
 *
 * Regression target: if this returns null for a valid row, the guard
 * in PlanReviewPage redirects to /onboarding, the agent pushes
 * current_step up again, and the user ping-pongs forever. Any change
 * to what the agent writes into onboarding_states.data has to keep
 * these shapes working.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { deriveStateFromOnboarding } from '../planReviewDerive';

describe('deriveStateFromOnboarding', () => {
  // Minimal valid data — what the agent writes after ONBOARD-05/06/08.
  // Habit shape includes `schedule` per api/_lib/vapi/handlers/addHabit.ts.
  const validData = {
    habitConfigs: {
      'Morning walk': {
        days: [1, 2, 3, 4, 5],
        time: '07:00',
        reminder: true,
        schedule: 'Weekday',
      },
      Meditate: {
        days: [0, 1, 2, 3, 4, 5, 6],
        time: '21:00',
        reminder: false,
        schedule: 'Every day',
      },
    },
    reflectionConfig: {
      time: '22:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      reminder: true,
      schedule: 'Every day',
    },
    goals: ['Fall asleep earlier', 'Move more consistently'],
    category: 'Sleep better',
  };

  it('rehydrates every field when data is complete', () => {
    const result = deriveStateFromOnboarding(validData);
    expect(result).not.toBeNull();
    expect(result!.habitConfigs['Morning walk']).toEqual({
      days: [1, 2, 3, 4, 5],
      time: '07:00',
      reminder: true,
      schedule: 'Weekday',
    });
    expect(result!.habitConfigs.Meditate.reminder).toBe(false);
    expect(result!.habitConfigs.Meditate.schedule).toBe('Every day');
    expect(result!.reflectionConfig).toEqual({
      time: '22:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      reminder: true,
      schedule: 'Every day',
    });
    expect(result!.goals).toEqual(['Fall asleep earlier', 'Move more consistently']);
    expect(result!.category).toBe('Sleep better');
  });

  it('returns null on null input (no row fetched yet)', () => {
    expect(deriveStateFromOnboarding(null)).toBeNull();
  });

  it('returns null on undefined input', () => {
    expect(deriveStateFromOnboarding(undefined)).toBeNull();
  });

  it('returns null on non-object input (bad type assertion upstream)', () => {
    expect(deriveStateFromOnboarding('oops')).toBeNull();
    expect(deriveStateFromOnboarding(42)).toBeNull();
    expect(deriveStateFromOnboarding([])).toBeNull(); // arrays have no habitConfigs
  });

  it('returns null when habitConfigs is missing (agent hasnt reached step 5 yet)', () => {
    const partial = { ...validData, habitConfigs: undefined };
    expect(deriveStateFromOnboarding(partial)).toBeNull();
  });

  it('returns null when habitConfigs is present but empty (nothing picked yet)', () => {
    expect(
      deriveStateFromOnboarding({
        ...validData,
        habitConfigs: {},
      }),
    ).toBeNull();
  });

  it('returns null when reflectionConfig is missing (agent hasnt reached step 8 yet)', () => {
    const partial = { ...validData, reflectionConfig: undefined };
    expect(deriveStateFromOnboarding(partial)).toBeNull();
  });

  it('handles habitConfigs entries whose days came in as a Set (legacy router-state shape)', () => {
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        Stretch: {
          days: new Set([1, 3, 5]),
          time: '18:00',
          reminder: true,
        },
      },
    });
    expect(result!.habitConfigs.Stretch.days).toEqual([1, 3, 5]);
  });

  it('coerces missing time / reminder fields to safe defaults', () => {
    // Agent may have written a partial config if the user interrupted
    // mid-turn. We take what we can — empty time + false reminder is
    // still a loadable plan; the user can edit it.
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        Vague: { days: [1, 2] },
      },
    });
    expect(result!.habitConfigs.Vague).toEqual({
      days: [1, 2],
      time: '',
      reminder: false,
    });
  });

  it('ignores habit entries that are not objects (agent wrote garbage)', () => {
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        Real: { days: [1], time: '08:00', reminder: false },
        Broken: 'not an object',
      },
    });
    expect(result!.habitConfigs.Real).toBeDefined();
    expect(result!.habitConfigs.Broken).toBeUndefined();
  });

  it('filters non-number entries out of days arrays (defensive)', () => {
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        Clean: {
          days: [1, 'x', 3, null, 5] as unknown[],
          time: '09:00',
          reminder: false,
        },
      },
    });
    expect(result!.habitConfigs.Clean.days).toEqual([1, 3, 5]);
  });

  it('omits optional goals / category fields cleanly when absent', () => {
    const result = deriveStateFromOnboarding({
      habitConfigs: validData.habitConfigs,
      reflectionConfig: validData.reflectionConfig,
    });
    expect(result!.goals).toBeUndefined();
    expect(result!.category).toBeUndefined();
  });

  it('passes the schedule field through verbatim (informational; cadence reads days only)', () => {
    // Post-Mint-round-2 the page renders formatCadence(days) and ignores
    // schedule. Backend reconciliation (api/_lib/vapi/handlers/addHabit.ts +
    // submitReflectionConfig.ts) and frontend HabitCustomizeSheet now keep
    // days authoritative, so a stale-shape row like the one below should
    // not occur in practice. We still preserve the field through derive so
    // future consumers (e.g. edit screens) can read it without re-fetching.
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        '5-minute breathing': {
          days: [0, 1, 2, 3, 4, 5, 6],
          time: '09:00',
          reminder: true,
          schedule: 'Weekday',
        },
      },
    });
    expect(result!.habitConfigs['5-minute breathing']).toEqual({
      days: [0, 1, 2, 3, 4, 5, 6],
      time: '09:00',
      reminder: true,
      schedule: 'Weekday',
    });
  });

  it('omits schedule key when not present (advanced-flow habit shape)', () => {
    // AdvancedStep6Page builds habitConfigs without `schedule`.
    // PlanReviewPage falls back to formatCadence(days) in that case.
    const result = deriveStateFromOnboarding({
      ...validData,
      habitConfigs: {
        Stretch: { days: [1, 3, 5], time: '18:00', reminder: true },
      },
    });
    expect(result!.habitConfigs.Stretch).toEqual({
      days: [1, 3, 5],
      time: '18:00',
      reminder: true,
    });
    expect('schedule' in result!.habitConfigs.Stretch).toBe(false);
  });

  it('drops non-string goals silently', () => {
    const result = deriveStateFromOnboarding({
      ...validData,
      // Whole field becomes undefined if it isnt an array — that keeps
      // downstream code from rendering `[object Object]`.
      goals: { somehow: 'wrong' },
    });
    expect(result!.goals).toBeUndefined();
  });
});
