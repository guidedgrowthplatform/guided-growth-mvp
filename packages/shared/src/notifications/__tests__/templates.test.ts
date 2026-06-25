import { describe, expect, it } from 'vitest';
import {
  REMINDER_VARIANTS,
  buildNotificationContent,
  parseHHMM,
  reminderVariantIndex,
} from '../templates.js';

describe('parseHHMM', () => {
  it('parses HH:MM', () => {
    expect(parseHHMM('07:00')).toEqual({ hour: 7, minute: 0 });
    expect(parseHHMM('22:30')).toEqual({ hour: 22, minute: 30 });
  });

  it('tolerates seconds', () => {
    expect(parseHHMM('08:15:00')).toEqual({ hour: 8, minute: 15 });
  });

  it('rejects out-of-range and garbage', () => {
    expect(parseHHMM('99:99')).toBeNull();
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('noon')).toBeNull();
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM(null)).toBeNull();
  });
});

describe('buildNotificationContent', () => {
  it('morning variant 0 → journal / /home?checkin=morning', () => {
    const c = buildNotificationContent('morning_checkin', 'Sam', 0);
    expect(c.category).toBe('journal');
    expect(c.data.route).toBe('/home?checkin=morning');
    expect(c.title).toBe(REMINDER_VARIANTS.morning_checkin[0].title);
    expect(c.body).toBe(REMINDER_VARIANTS.morning_checkin[0].body);
  });

  it('evening variant 0 → journal / /home?checkin=evening', () => {
    const c = buildNotificationContent('evening_checkin', null, 0);
    expect(c.category).toBe('journal');
    expect(c.data.route).toBe('/home?checkin=evening');
    expect(c.title).toBe(REMINDER_VARIANTS.evening_checkin[0].title);
    expect(c.body).toBe(REMINDER_VARIANTS.evening_checkin[0].body);
  });

  it('variantIndex selects the matching element', () => {
    const c = buildNotificationContent('morning_checkin', null, 2);
    expect(c.title).toBe(REMINDER_VARIANTS.morning_checkin[2].title);
    expect(c.body).toBe(REMINDER_VARIANTS.morning_checkin[2].body);
  });

  it('out-of-range variantIndex wraps via modulo', () => {
    const len = REMINDER_VARIANTS.morning_checkin.length;
    const c = buildNotificationContent('morning_checkin', null, len + 2);
    expect(c.title).toBe(REMINDER_VARIANTS.morning_checkin[2].title);
  });

  it('defaults to index 0 when variantIndex omitted', () => {
    const def = buildNotificationContent('evening_checkin', null);
    const zero = buildNotificationContent('evening_checkin', null, 0);
    expect(def.title).toBe(zero.title);
    expect(def.body).toBe(zero.body);
  });

  it('session_expired → account / /login (no name needed)', () => {
    const c = buildNotificationContent('session_expired', null);
    expect(c.category).toBe('account');
    expect(c.data.route).toBe('/login');
    expect(c.data.type).toBe('session_expired');
    expect(c.title).toBe('Your session expired');
  });

  it('session_expired ignores variantIndex', () => {
    const a = buildNotificationContent('session_expired', null);
    const b = buildNotificationContent('session_expired', null, 5);
    expect(b).toEqual(a);
    expect(b.data.route).toBe('/login');
    expect(b.category).toBe('account');
  });
});

describe('reminderVariantIndex', () => {
  // mirrors the source formula; local date components, DST-immune
  const expectedIndex = (y: number, m: number, d: number) =>
    ((Math.floor(Date.UTC(y, m, d) / 86_400_000) % 7) + 7) % 7;

  it('returns a value in 0..6', () => {
    const i = reminderVariantIndex(new Date(2026, 5, 23, 9, 0));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThanOrEqual(6);
  });

  it('is stable across time-of-day for the same calendar day', () => {
    const morning = reminderVariantIndex(new Date(2026, 5, 23, 1, 30));
    const night = reminderVariantIndex(new Date(2026, 5, 23, 23, 45));
    expect(morning).toBe(night);
    expect(morning).toBe(expectedIndex(2026, 5, 23));
  });

  it('advances by exactly 1 (mod 7) on consecutive days', () => {
    const day1 = reminderVariantIndex(new Date(2026, 5, 23, 12));
    const day2 = reminderVariantIndex(new Date(2026, 5, 24, 12));
    expect(day2).toBe((day1 + 1) % 7);
  });

  it('does not double-count across US spring-forward (2026-03-08)', () => {
    const before = reminderVariantIndex(new Date(2026, 2, 7, 12));
    const dst = reminderVariantIndex(new Date(2026, 2, 8, 12));
    const after = reminderVariantIndex(new Date(2026, 2, 9, 12));
    expect(dst).toBe(expectedIndex(2026, 2, 8));
    expect(dst).toBe((before + 1) % 7);
    expect(after).toBe((dst + 1) % 7);
  });
});
