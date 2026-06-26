import { describe, it, expect } from 'vitest';
import { habitsByGoal } from '@gg/shared/data/onboardingHabits';
import { CURATED_HABIT_POLARITY, resolveHabitPolarity } from './curatedHabitPolarity';

const curatedNames = [...new Set(Object.values(habitsByGoal).flat())];

describe('curated habit polarity coverage', () => {
  it('tags EVERY curated habit explicitly (none left to inference)', () => {
    const untagged = curatedNames.filter((n) => !(n in CURATED_HABIT_POLARITY));
    expect(untagged).toEqual([]);
  });

  it('every curated value is positive or negative', () => {
    for (const v of Object.values(CURATED_HABIT_POLARITY)) {
      expect(['positive', 'negative']).toContain(v);
    }
  });
});

describe('resolveHabitPolarity', () => {
  it('resolves a curated habit from the explicit map', () => {
    expect(resolveHabitPolarity('No caffeine after 2 PM')).toEqual({
      polarity: 'negative',
      source: 'curated',
    });
    expect(resolveHabitPolarity('Drink water before coffee')).toEqual({
      polarity: 'positive',
      source: 'curated',
    });
  });

  it('infers a clear non-curated habit', () => {
    expect(resolveHabitPolarity('Stop biting nails')).toEqual({
      polarity: 'negative',
      source: 'inferred',
    });
    expect(resolveHabitPolarity('Meditate twice')).toEqual({
      polarity: 'positive',
      source: 'inferred',
    });
  });

  it('flags an unclear non-curated habit for confirmation', () => {
    expect(resolveHabitPolarity('Thermostat')).toEqual({ polarity: null, source: 'unclear' });
  });
});
