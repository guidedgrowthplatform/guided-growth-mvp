import { describe, expect, it } from 'vitest';
import { isRecoverableVoiceError, shouldStartVoiceIn } from '../useVoiceInCapture';

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

// #232 gate: the "can't hear you" bubble is swallowed only when the error is recoverable
// AND we already heard a final. Terminal errors must NEVER be classed recoverable, so they
// always fall through to onError even after a final was heard.
describe('isRecoverableVoiceError (#232 swallow gate)', () => {
  it('treats transient drops as recoverable (eligible for swallow after a final)', () => {
    expect(isRecoverableVoiceError('voice connection lost')).toBe(true);
    expect(isRecoverableVoiceError('microphone track ended')).toBe(true);
    expect(isRecoverableVoiceError('watchdog timeout')).toBe(true);
  });
  it('treats mic permission/device loss as terminal (never swallowed)', () => {
    expect(isRecoverableVoiceError('Permission denied')).toBe(false);
    expect(isRecoverableVoiceError('NotAllowedError')).toBe(false);
    expect(isRecoverableVoiceError('NotFoundError: requested device not found')).toBe(false);
    expect(isRecoverableVoiceError('no device available')).toBe(false);
  });
});
