/**
 * Vapi-live gate, with the idle auto-pause conjunct under test.
 *
 * Regression context: the idle timer calls systemPauseMic() after 8s of
 * silence, setting micPausedReason='system'. That flag only gated the Soniox
 * STT path; the Vapi mic + WebRTC call ignored it and stayed fully live,
 * burning voice minutes indefinitely. The fix folds `micPausedReason == null`
 * into this gate so an idle pause makes the call tear down (and a later user
 * gesture clears the flag, re-arming Vapi).
 */
import { describe, expect, it } from 'vitest';
import { vapiLiveGate, type VapiLiveGateInput } from '../vapiLiveGate';

const liveInput: VapiLiveGateInput = {
  engineIsVapi: true,
  micPermission: true,
  micEnabled: true,
  hasAnonId: true,
  fatalError: false,
  remoteEndCooldown: false,
  voiceCapReached: false,
  micPausedReason: null,
};

describe('vapiLiveGate', () => {
  it('is live when every gate passes and not idle-paused', () => {
    expect(vapiLiveGate(liveInput)).toBe(true);
  });

  it('idle auto-pause (micPausedReason=system) stops the live Vapi call', () => {
    expect(vapiLiveGate({ ...liveInput, micPausedReason: 'system' })).toBe(false);
  });

  it('clearing the idle pause re-enables Vapi (re-arm path)', () => {
    const paused = vapiLiveGate({ ...liveInput, micPausedReason: 'system' });
    const resumed = vapiLiveGate({ ...liveInput, micPausedReason: null });
    expect(paused).toBe(false);
    expect(resumed).toBe(true);
  });

  it('still respects every other gate', () => {
    expect(vapiLiveGate({ ...liveInput, engineIsVapi: false })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, micPermission: false })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, micEnabled: false })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, hasAnonId: false })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, fatalError: true })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, remoteEndCooldown: true })).toBe(false);
    expect(vapiLiveGate({ ...liveInput, voiceCapReached: true })).toBe(false);
  });
});
