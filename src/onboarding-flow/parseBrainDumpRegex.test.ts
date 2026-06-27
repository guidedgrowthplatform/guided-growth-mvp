import { describe, it, expect } from 'vitest';
import { parseHabitsRegex, extractDaysRegex } from './parseBrainDumpRegex';

describe('extractDaysRegex', () => {
  it('maps concrete schedules to day indices', () => {
    expect(extractDaysRegex('every day')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(extractDaysRegex('daily')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(extractDaysRegex('weekdays')).toEqual([1, 2, 3, 4, 5]);
    expect(extractDaysRegex('on weekends')).toEqual([0, 6]);
    expect(extractDaysRegex('monday wednesday friday')).toEqual([1, 3, 5]);
    expect(extractDaysRegex('mon and thurs')).toEqual([1, 4]);
  });
  it('returns undefined for vague counts', () => {
    expect(extractDaysRegex('three times a week')).toBeUndefined();
    expect(extractDaysRegex('once a week')).toBeUndefined();
    expect(extractDaysRegex('go running')).toBeUndefined();
  });
});

describe('parseHabitsRegex', () => {
  it('splits a dump into clean names with explicit days', () => {
    const r = parseHabitsRegex(
      'go to the gym Monday Wednesday Friday, meditate daily, no caffeine, read before bed',
    );
    expect(r).toEqual([
      { name: 'go to the gym', days: [1, 3, 5] },
      { name: 'meditate', days: [0, 1, 2, 3, 4, 5, 6] },
      { name: 'no caffeine' },
      { name: 'read before bed' },
    ]);
  });

  it('strips lead-ins and vague frequency from the name', () => {
    const r = parseHabitsRegex('I want to go running and also call mom weekly');
    expect(r).toEqual([{ name: 'go running' }, { name: 'call mom' }]);
  });

  it('strips intent verbs even without a leading "I"', () => {
    // "want to read" (no "I", after splitting on "and") must not keep "want to".
    expect(parseHabitsRegex('I want to run and want to read')).toEqual([
      { name: 'run' },
      { name: 'read' },
    ]);
    expect(parseHabitsRegex("going to meditate, gonna walk, I'm gonna stretch")).toEqual([
      { name: 'meditate' },
      { name: 'walk' },
      { name: 'stretch' },
    ]);
  });

  it('drops filler/non-habit clauses', () => {
    const r = parseHabitsRegex('um, you know, run, and stuff');
    expect(r).toEqual([{ name: 'run' }]);
  });

  it('strips time-of-day from the name, leaving days empty', () => {
    expect(parseHabitsRegex('stretch every morning')).toEqual([{ name: 'stretch' }]);
  });

  it('dedupes by name', () => {
    const r = parseHabitsRegex('meditate, meditate daily');
    expect(r).toHaveLength(1);
  });

  it('returns empty for nothing concrete', () => {
    expect(parseHabitsRegex('   ')).toEqual([]);
  });
});
