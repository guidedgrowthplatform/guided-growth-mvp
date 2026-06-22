import { describe, it, expect } from 'vitest';
import { bucketFromHour, bucketTimeOfDay } from '../bucketTimeOfDay.js';

describe('bucketFromHour', () => {
  it('matches HabitsSection cutoffs (<12, <17, <21, else)', () => {
    expect(bucketFromHour(0)).toBe('morning');
    expect(bucketFromHour(11)).toBe('morning');
    expect(bucketFromHour(12)).toBe('afternoon');
    expect(bucketFromHour(16)).toBe('afternoon');
    expect(bucketFromHour(17)).toBe('evening');
    expect(bucketFromHour(20)).toBe('evening');
    expect(bucketFromHour(21)).toBe('night');
    expect(bucketFromHour(23)).toBe('night');
  });
});

describe('bucketTimeOfDay', () => {
  it('buckets a UTC instant by the target timezone', () => {
    // 2026-06-16T02:00:00Z → 22:00 in New York (night), 11:00 in Tokyo (morning).
    const d = new Date('2026-06-16T02:00:00Z');
    expect(bucketTimeOfDay(d, 'America/New_York')).toBe('night');
    expect(bucketTimeOfDay(d, 'Asia/Tokyo')).toBe('morning');
  });

  it('throws on an invalid timezone so callers can fall back', () => {
    expect(() => bucketTimeOfDay(new Date(), 'Not/AZone')).toThrow();
  });
});
