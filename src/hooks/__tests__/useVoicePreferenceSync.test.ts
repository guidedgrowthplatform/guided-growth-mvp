/**
 * Tests for decideVoicePreferenceSync — the pure decision function inside
 * useVoicePreferenceSync.
 *
 * Why test the predicate and not the hook: the contract that matters is
 * "if the user picked text-only in onboarding (voiceEnabled=false) and the
 * runtime store still has TTS on, force it off — exactly once". Mocking
 * react + zustand + supabase to drive the hook would add indirection
 * without catching more bugs.
 *
 * Closes GLOB-07: preferences.voiceEnabled was an orphan field — saved by
 * VoicePreferencePage but never read post-onboarding, so users who picked
 * "text only" still got TTS on next app open.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { decideVoicePreferenceSync } from '../useVoicePreferenceSync';

describe('decideVoicePreferenceSync', () => {
  it('returns noop when preferences are still loading', () => {
    expect(
      decideVoicePreferenceSync({
        loaded: false,
        voiceEnabled: false,
        ttsEnabled: true,
      }),
    ).toBe('noop');
  });

  it('returns noop when voiceEnabled is true (do not force TTS on)', () => {
    expect(
      decideVoicePreferenceSync({
        loaded: true,
        voiceEnabled: true,
        ttsEnabled: false,
      }),
    ).toBe('noop');
  });

  it('returns force-off when voiceEnabled is false and ttsEnabled is true', () => {
    expect(
      decideVoicePreferenceSync({
        loaded: true,
        voiceEnabled: false,
        ttsEnabled: true,
      }),
    ).toBe('force-off');
  });

  it('returns noop when voiceEnabled is false but ttsEnabled is already false (idempotent)', () => {
    expect(
      decideVoicePreferenceSync({
        loaded: true,
        voiceEnabled: false,
        ttsEnabled: false,
      }),
    ).toBe('noop');
  });

  it('returns noop when voiceEnabled is undefined (pre-onboarding user)', () => {
    expect(
      decideVoicePreferenceSync({
        loaded: true,
        voiceEnabled: undefined,
        ttsEnabled: true,
      }),
    ).toBe('noop');
  });
});
