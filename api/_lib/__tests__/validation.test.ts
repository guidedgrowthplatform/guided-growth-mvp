import { describe, it, expect } from 'vitest';
import { validateDate, validateUUID, validateTimezone, getClientIp, UUID_REGEX } from '../validation';

describe('validateDate', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(validateDate('2026-03-15')).toBe('2026-03-15');
    expect(validateDate('2024-01-01')).toBe('2024-01-01');
    expect(validateDate('2026-12-31')).toBe('2026-12-31');
  });

  it('rejects invalid date formats', () => {
    expect(validateDate('15-03-2026')).toBeNull();
    expect(validateDate('2026/03/15')).toBeNull();
    expect(validateDate('03-15-2026')).toBeNull();
    expect(validateDate('not-a-date')).toBeNull();
    expect(validateDate('')).toBeNull();
    expect(validateDate('2026-3-5')).toBeNull();
  });

  it('rejects non-existent dates', () => {
    expect(validateDate('2026-02-30')).toBeNull();
    expect(validateDate('2026-13-01')).toBeNull();
    expect(validateDate('2026-00-01')).toBeNull();
    expect(validateDate('2026-04-31')).toBeNull();
  });

  it('rejects non-string inputs', () => {
    expect(validateDate(null)).toBeNull();
    expect(validateDate(undefined)).toBeNull();
    expect(validateDate(123)).toBeNull();
    expect(validateDate(['2026-03-15'])).toBeNull();
  });

  it('rejects injection attempts', () => {
    expect(validateDate('2026-03-15; DROP TABLE users')).toBeNull();
    expect(validateDate('../../etc')).toBeNull();
    expect(validateDate('2026-03-15\r\nX-Injected: evil')).toBeNull();
  });

  it('handles leap year correctly', () => {
    expect(validateDate('2024-02-29')).toBe('2024-02-29'); // leap year
    expect(validateDate('2025-02-29')).toBeNull(); // not a leap year
  });
});

describe('validateUUID', () => {
  it('accepts valid UUID v4', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('rejects invalid UUIDs', () => {
    expect(validateUUID('not-a-uuid')).toBeNull();
    expect(validateUUID('')).toBeNull();
    expect(validateUUID('550e8400-e29b-41d4-a716')).toBeNull();
    expect(validateUUID(null)).toBeNull();
    expect(validateUUID(123)).toBeNull();
  });
});

describe('validateTimezone', () => {
  it('accepts valid IANA zones', () => {
    expect(validateTimezone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(validateTimezone('Asia/Jakarta')).toBe('Asia/Jakarta');
    expect(validateTimezone('UTC')).toBe('UTC');
  });

  it('rejects unknown / malformed zones', () => {
    expect(validateTimezone('Foo/Bar')).toBeNull();
    expect(validateTimezone('+05:00')).toBeNull();
    expect(validateTimezone('America/Los_Angeles ')).toBeNull(); // trailing space
  });

  it('rejects empty, oversized, and non-string inputs', () => {
    expect(validateTimezone('')).toBeNull();
    expect(validateTimezone('A'.repeat(65))).toBeNull();
    expect(validateTimezone(null)).toBeNull();
    expect(validateTimezone(undefined)).toBeNull();
    expect(validateTimezone(123)).toBeNull();
  });
});

describe('UUID_REGEX', () => {
  it('matches a canonical v4', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects 32-char no-dash form', () => {
    expect(UUID_REGEX.test('550e8400e29b41d4a716446655440000')).toBe(false);
  });

  it('rejects non-v4 versions', () => {
    // v1
    expect(UUID_REGEX.test('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
    // v3
    expect(UUID_REGEX.test('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
    // v5
    expect(UUID_REGEX.test('550e8400-e29b-51d4-a716-446655440000')).toBe(false);
    // v7
    expect(UUID_REGEX.test('550e8400-e29b-71d4-a716-446655440000')).toBe(false);
  });

  it('rejects invalid variant nibble', () => {
    // variant must be [89ab]; `c` invalid
    expect(UUID_REGEX.test('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    expect(UUID_REGEX.test('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBe(false);
  });
});

describe('getClientIp', () => {
  it('prefers x-real-ip', () => {
    expect(
      getClientIp({
        'x-real-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8, 9.10.11.12',
      }),
    ).toBe('1.2.3.4');
  });

  it('falls back to x-forwarded-for first entry', () => {
    expect(
      getClientIp({
        'x-forwarded-for': '5.6.7.8, 9.10.11.12',
      }),
    ).toBe('5.6.7.8');
  });

  it('returns unknown when no IP headers', () => {
    expect(getClientIp({})).toBe('unknown');
  });

  it('trims whitespace', () => {
    expect(getClientIp({ 'x-real-ip': '  1.2.3.4  ' })).toBe('1.2.3.4');
  });
});
