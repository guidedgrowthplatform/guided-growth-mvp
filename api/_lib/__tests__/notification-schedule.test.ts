import { describe, expect, it } from 'vitest';
import { computeDue, type SchedulePrefs } from '../notification-schedule.js';

const prefs = (overrides: Partial<SchedulePrefs>): SchedulePrefs => ({
  anon_id: 'a-1',
  first_name: 'Ana',
  timezone: 'UTC',
  morning_time: null,
  night_time: null,
  ...overrides,
});

describe('computeDue', () => {
  it('due exactly at the scheduled minute', () => {
    const due = computeDue([prefs({ morning_time: '08:00:00' })], new Date('2026-06-11T08:00:00Z'));
    expect(due).toEqual([
      { anon_id: 'a-1', first_name: 'Ana', type: 'morning_checkin', local_date: '2026-06-11' },
    ]);
  });

  it('due within the 60-minute lookback (late cron run)', () => {
    const due = computeDue([prefs({ morning_time: '08:00:00' })], new Date('2026-06-11T08:59:00Z'));
    expect(due).toHaveLength(1);
  });

  it('not due at 60+ minutes past', () => {
    const due = computeDue([prefs({ morning_time: '08:00:00' })], new Date('2026-06-11T09:00:00Z'));
    expect(due).toHaveLength(0);
  });

  it('not due before the scheduled time', () => {
    const due = computeDue([prefs({ morning_time: '08:00:00' })], new Date('2026-06-11T07:59:00Z'));
    expect(due).toHaveLength(0);
  });

  it('midnight wrap: 23:30 schedule still due at 00:15, anchored to the scheduled day', () => {
    const due = computeDue([prefs({ night_time: '23:30:00' })], new Date('2026-06-12T00:15:00Z'));
    expect(due).toEqual([
      { anon_id: 'a-1', first_name: 'Ana', type: 'evening_checkin', local_date: '2026-06-11' },
    ]);
  });

  it('midnight wrap idempotency: same local_date before and after the boundary', () => {
    const before = computeDue(
      [prefs({ night_time: '23:30:00' })],
      new Date('2026-06-11T23:45:00Z'),
    );
    const after = computeDue([prefs({ night_time: '23:30:00' })], new Date('2026-06-12T00:15:00Z'));
    expect(before[0].local_date).toBe('2026-06-11');
    expect(after[0].local_date).toBe('2026-06-11');
  });

  it('respects the user timezone', () => {
    // 12:00Z = 21:00 in Tokyo, 13:00 in London
    const now = new Date('2026-06-11T12:00:00Z');
    const tokyo = computeDue([prefs({ timezone: 'Asia/Tokyo', night_time: '21:00:00' })], now);
    const london = computeDue([prefs({ timezone: 'Europe/London', night_time: '21:00:00' })], now);
    expect(tokyo).toHaveLength(1);
    expect(london).toHaveLength(0);
  });

  it('local_date is the timezone-local calendar day', () => {
    // 23:30Z on the 11th = 08:30 on the 12th in Tokyo
    const due = computeDue(
      [prefs({ timezone: 'Asia/Tokyo', morning_time: '08:00:00' })],
      new Date('2026-06-11T23:30:00Z'),
    );
    expect(due[0].local_date).toBe('2026-06-12');
  });

  it('skips unknown timezone strings instead of throwing', () => {
    const due = computeDue(
      [
        prefs({ timezone: 'Not/AZone', morning_time: '08:00:00' }),
        prefs({ anon_id: 'a-2', morning_time: '08:00:00' }),
      ],
      new Date('2026-06-11T08:00:00Z'),
    );
    expect(due.map((d) => d.anon_id)).toEqual(['a-2']);
  });

  it('skips null and malformed times', () => {
    const due = computeDue(
      [prefs({ morning_time: null, night_time: 'oops' })],
      new Date('2026-06-11T08:00:00Z'),
    );
    expect(due).toHaveLength(0);
  });

  it('DST spring-forward: schedule inside the skipped hour fires once the clock lands past it', () => {
    // America/New_York 2026-03-08: 02:00→03:00 skipped; 07:05Z = 03:05 EDT
    const due = computeDue(
      [prefs({ timezone: 'America/New_York', morning_time: '02:30:00' })],
      new Date('2026-03-08T07:05:00Z'),
    );
    expect(due).toEqual([
      { anon_id: 'a-1', first_name: 'Ana', type: 'morning_checkin', local_date: '2026-03-08' },
    ]);
  });

  it('emits both types when both windows are open', () => {
    const due = computeDue(
      [prefs({ morning_time: '08:00:00', night_time: '08:30:00' })],
      new Date('2026-06-11T08:45:00Z'),
    );
    expect(due.map((d) => d.type).sort()).toEqual(['evening_checkin', 'morning_checkin']);
  });
});
