import { describe, expect, it } from 'vitest';
import { buildRrule, buildWeeklyRrule } from '../rrule.js';

describe('buildRrule', () => {
  it('null/undefined/empty ⇒ daily', () => {
    expect(buildRrule(null)).toBe('RRULE:FREQ=DAILY');
    expect(buildRrule(undefined)).toBe('RRULE:FREQ=DAILY');
    expect(buildRrule([])).toBe('RRULE:FREQ=DAILY');
  });

  it('weekdays ⇒ weekly subset in canonical order', () => {
    expect(buildRrule([1, 2, 3, 4, 5])).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });

  it('weekend', () => {
    expect(buildRrule([0, 6])).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU,SA');
  });

  it('unsorted + duplicate input normalizes', () => {
    expect(buildRrule([3, 1, 3, 5, 1])).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('all seven days ⇒ daily', () => {
    expect(buildRrule([0, 1, 2, 3, 4, 5, 6])).toBe('RRULE:FREQ=DAILY');
  });

  it('out-of-range ints filtered out', () => {
    expect(buildRrule([1, 7, -1, 2, 99])).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU');
  });

  it('only-invalid ⇒ daily (nothing left)', () => {
    expect(buildRrule([7, 8, -3])).toBe('RRULE:FREQ=DAILY');
  });
});

describe('buildWeeklyRrule', () => {
  it('maps day int to BYDAY', () => {
    expect(buildWeeklyRrule(0)).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(buildWeeklyRrule(6)).toBe('RRULE:FREQ=WEEKLY;BYDAY=SA');
    expect(buildWeeklyRrule(3)).toBe('RRULE:FREQ=WEEKLY;BYDAY=WE');
  });

  it('out-of-range defaults to Sunday', () => {
    expect(buildWeeklyRrule(9)).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(buildWeeklyRrule(-1)).toBe('RRULE:FREQ=WEEKLY;BYDAY=SU');
  });
});
