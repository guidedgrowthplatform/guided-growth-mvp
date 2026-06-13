import { describe, expect, it } from 'vitest';
import { OpenAIError, parseRetryAfterMs } from '../openai.js';
import { isRateLimit, safeErrorFrame } from '../safeErrorFrame.js';
import { validateRecentEvents } from '../validateRecentEvents.js';

describe('parseRetryAfterMs', () => {
  it('parses seconds and clamps', () => {
    expect(parseRetryAfterMs('Rate limit reached. Please try again in 7.897s.')).toBe(7897);
    expect(parseRetryAfterMs('try again in 30s')).toBe(8000); // clamp max
    expect(parseRetryAfterMs('try again in 0.1s')).toBe(500); // clamp min
  });
  it('parses ms and falls back', () => {
    expect(parseRetryAfterMs('try again in 850ms')).toBe(850);
    expect(parseRetryAfterMs('no hint')).toBe(2000);
    expect(parseRetryAfterMs(undefined)).toBe(2000);
  });
});

describe('isRateLimit', () => {
  it('detects 429 / rate-limit signals', () => {
    expect(isRateLimit(new OpenAIError('x', 429))).toBe(true);
    expect(isRateLimit({ status: 429 })).toBe(true);
    expect(isRateLimit({ code: 'rate_limit_exceeded' })).toBe(true);
    expect(isRateLimit({ message: 'Rate limit reached for gpt-4o' })).toBe(true);
    expect(isRateLimit({ status: 500 })).toBe(false);
  });
});

describe('safeErrorFrame', () => {
  it('never leaks the raw upstream message', () => {
    const raw = 'Rate limit reached for gpt-4o in org-XYZ ... Used 26122';
    const frame = safeErrorFrame('rate_limited', new OpenAIError(raw, 429, 3000));
    expect(frame.message).not.toContain('org-XYZ');
    expect(frame.code).toBe('rate_limited');
    expect(frame.retryAfterMs).toBe(3000);
  });
});

describe('validateRecentEvents', () => {
  const good = {
    id: 'a',
    session_id: 's',
    timestamp: new Date(0).toISOString(),
    event_type: 'navigate',
    screen_id: null,
    payload: null,
  };
  it('accepts a valid array', () => {
    const r = validateRecentEvents([good]);
    expect(r.ok).toBe(true);
  });
  it('rejects non-arrays and malformed entries', () => {
    expect(validateRecentEvents('x').ok).toBe(false);
    expect(validateRecentEvents([{ ...good, timestamp: 'nope' }]).ok).toBe(false);
    expect(validateRecentEvents([{ ...good, id: 123 }]).ok).toBe(false);
  });
  it('rejects oversized arrays', () => {
    expect(validateRecentEvents(Array.from({ length: 101 }, () => good)).ok).toBe(false);
  });
});
