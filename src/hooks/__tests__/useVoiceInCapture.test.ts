import { describe, expect, it } from 'vitest';
import { shouldStartVoiceIn } from '../useVoiceInCapture';

describe('shouldStartVoiceIn', () => {
  it('false when inactive', () => {
    expect(shouldStartVoiceIn(false, 'idle')).toBe(false);
    expect(shouldStartVoiceIn(false, null)).toBe(false);
  });
  it('false while Vapi is active or connecting', () => {
    expect(shouldStartVoiceIn(true, 'active')).toBe(false);
    expect(shouldStartVoiceIn(true, 'connecting')).toBe(false);
  });
  it('true on idle/ended/error/null when active', () => {
    expect(shouldStartVoiceIn(true, 'idle')).toBe(true);
    expect(shouldStartVoiceIn(true, 'ended')).toBe(true);
    expect(shouldStartVoiceIn(true, 'error')).toBe(true);
    expect(shouldStartVoiceIn(true, null)).toBe(true);
    expect(shouldStartVoiceIn(true, undefined)).toBe(true);
  });
});
