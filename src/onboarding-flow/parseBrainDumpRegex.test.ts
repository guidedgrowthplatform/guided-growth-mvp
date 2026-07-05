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

  it('drops trailed-off lead-in fragments instead of carding them', () => {
    // These are the half-spoken fragments that used to become "Want to. I want"
    // style cards. After stripping the lead-ins nothing real is left, so reject.
    expect(parseHabitsRegex('I want to')).toEqual([]);
    expect(parseHabitsRegex('I want to. I want')).toEqual([]);
    expect(parseHabitsRegex("I'm going to")).toEqual([]);
    expect(parseHabitsRegex('I need to')).toEqual([]);
  });

  it('drops disfluent false starts and bare negations', () => {
    // The exact fragment that wrongly carded as "But I don't—uh".
    expect(parseHabitsRegex('but I don—uh')).toEqual([]);
    expect(parseHabitsRegex('um, so like, but I don’t')).toEqual([]);
    // ...but a real habit in the same breath still comes through.
    expect(parseHabitsRegex('run, but I don—uh')).toEqual([{ name: 'run' }]);
    expect(parseHabitsRegex('I want to run, um, and bake')).toEqual([
      { name: 'run' },
      { name: 'bake' },
    ]);
  });

  it('drops quote-wrapped and pronoun-led narration', () => {
    // The exact junk from the screenshot: quote-wrapped fragments + narration.
    expect(parseHabitsRegex('"but I don\'t')).toEqual([]);
    expect(parseHabitsRegex('" uh')).toEqual([]);
    expect(parseHabitsRegex('but look')).toEqual([]);
    expect(parseHabitsRegex('it said')).toEqual([]);
    expect(parseHabitsRegex('we need to find a middle ground')).toEqual([]);
    // A real habit wrapped in quotes still survives.
    expect(parseHabitsRegex('"go to the gym"')).toEqual([{ name: 'go to the gym' }]);
  });

  it('strips stacked lead-ins down to the real action', () => {
    expect(parseHabitsRegex('I want to start to go to the gym')).toEqual([
      { name: 'go to the gym' },
    ]);
    expect(parseHabitsRegex('I want to. I want to write')).toEqual([{ name: 'write' }]);
  });
});
