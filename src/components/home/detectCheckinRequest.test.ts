import { describe, expect, it } from 'vitest';
import { isCheckinRequest } from './detectCheckinRequest';

describe('isCheckinRequest', () => {
  it('matches explicit check-in requests', () => {
    expect(isCheckinRequest("Let's do evening check-ins.")).toBe(true);
    expect(isCheckinRequest('start my check-in')).toBe(true);
    expect(isCheckinRequest('do my morning checkin')).toBe(true);
    expect(isCheckinRequest('check in')).toBe(true);
    expect(isCheckinRequest('my check-in')).toBe(true);
  });

  it('ignores social check-ins and unrelated messages', () => {
    expect(isCheckinRequest('I need to check in with my boss')).toBe(false);
    expect(isCheckinRequest('let me check in on the kids')).toBe(false);
    expect(isCheckinRequest('how was my week')).toBe(false);
    expect(isCheckinRequest('I want to reflect on today')).toBe(false);
    expect(isCheckinRequest('log a reflection: grateful for coffee')).toBe(false);
  });
});
