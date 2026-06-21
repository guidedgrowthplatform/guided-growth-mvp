import { describe, expect, it } from 'vitest';
import { buildNotificationContent, parseHHMM } from '../templates.js';

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
  it('morning → habit / /home?checkin=morning', () => {
    const c = buildNotificationContent('morning_checkin', 'Sam');
    expect(c.category).toBe('habit');
    expect(c.data.route).toBe('/home?checkin=morning');
    expect(c.title).toBe('Hi Sam!');
  });

  it('evening → journal / /home?checkin=evening', () => {
    const c = buildNotificationContent('evening_checkin', null);
    expect(c.category).toBe('journal');
    expect(c.data.route).toBe('/home?checkin=evening');
    expect(c.title).toBe('Hi there!');
  });

  it('session_expired → account / /login (no name needed)', () => {
    const c = buildNotificationContent('session_expired', null);
    expect(c.category).toBe('account');
    expect(c.data.route).toBe('/login');
    expect(c.data.type).toBe('session_expired');
    expect(c.title).toBe('Your session expired');
  });
});
