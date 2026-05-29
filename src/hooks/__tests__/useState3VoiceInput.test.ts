import { describe, expect, it } from 'vitest';
import { shouldStartState3 } from '../useState3VoiceInput';

describe('shouldStartState3', () => {
  it('false when inactive', () => {
    expect(shouldStartState3(false, 'idle')).toBe(false);
    expect(shouldStartState3(false, null)).toBe(false);
  });
  it('false while Vapi is active or connecting', () => {
    expect(shouldStartState3(true, 'active')).toBe(false);
    expect(shouldStartState3(true, 'connecting')).toBe(false);
  });
  it('true on idle/ended/error/null when active', () => {
    expect(shouldStartState3(true, 'idle')).toBe(true);
    expect(shouldStartState3(true, 'ended')).toBe(true);
    expect(shouldStartState3(true, 'error')).toBe(true);
    expect(shouldStartState3(true, null)).toBe(true);
    expect(shouldStartState3(true, undefined)).toBe(true);
  });
});
