import { describe, expect, it } from 'vitest';
import { orbStateFrom } from '../orbState';
import { routeOrbSend } from '../routeOrbSend';

describe('orbStateFrom', () => {
  it('voice + mic → vapi', () => {
    expect(orbStateFrom(true, true)).toBe('vapi');
  });
  it('voice only → voice_out_only', () => {
    expect(orbStateFrom(true, false)).toBe('voice_out_only');
  });
  it('mic only → voice_in_only', () => {
    expect(orbStateFrom(false, true)).toBe('voice_in_only');
  });
  it('neither → text_only', () => {
    expect(orbStateFrom(false, false)).toBe('text_only');
  });
});

describe('routeOrbSend', () => {
  const base = { isOnboardingScreen: true, isProcessing: false, isStreaming: false };

  it('processing → noop regardless of state', () => {
    expect(routeOrbSend({ ...base, orbState: 'vapi', isProcessing: true })).toBe('noop');
    expect(routeOrbSend({ ...base, orbState: 'text_only', isProcessing: true })).toBe('noop');
  });
  it('streaming → noop regardless of state', () => {
    expect(routeOrbSend({ ...base, orbState: 'text_only', isStreaming: true })).toBe('noop');
  });
  it('vapi → vapi', () => {
    expect(routeOrbSend({ ...base, orbState: 'vapi' })).toBe('vapi');
  });
  it('onboarding screen, non-vapi → onboarding', () => {
    expect(routeOrbSend({ ...base, orbState: 'text_only' })).toBe('onboarding');
    expect(routeOrbSend({ ...base, orbState: 'voice_out_only' })).toBe('onboarding');
    expect(routeOrbSend({ ...base, orbState: 'voice_in_only' })).toBe('onboarding');
  });
  it('non-onboarding screen, non-vapi → llm', () => {
    const off = { ...base, isOnboardingScreen: false };
    expect(routeOrbSend({ ...off, orbState: 'text_only' })).toBe('llm');
    expect(routeOrbSend({ ...off, orbState: 'voice_out_only' })).toBe('llm');
    expect(routeOrbSend({ ...off, orbState: 'voice_in_only' })).toBe('llm');
  });
});
