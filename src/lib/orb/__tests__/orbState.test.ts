import { describe, expect, it } from 'vitest';
import { orbStateFrom, resolveActiveRings, resolveOrbMic } from '../orbState';
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
  const base = {
    surface: 'onboarding' as const,
    isProcessing: false,
    isStreaming: false,
  };

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
  it('onboarding surface, non-vapi → onboarding', () => {
    expect(routeOrbSend({ ...base, orbState: 'text_only' })).toBe('onboarding');
    expect(routeOrbSend({ ...base, orbState: 'voice_out_only' })).toBe('onboarding');
    expect(routeOrbSend({ ...base, orbState: 'voice_in_only' })).toBe('onboarding');
  });
  it('checkin surface, non-vapi → checkin', () => {
    const checkin = { ...base, surface: 'checkin' as const };
    expect(routeOrbSend({ ...checkin, orbState: 'text_only' })).toBe('checkin');
    expect(routeOrbSend({ ...checkin, orbState: 'voice_out_only' })).toBe('checkin');
    expect(routeOrbSend({ ...checkin, orbState: 'voice_in_only' })).toBe('checkin');
  });
  it('coach surface, non-vapi → llm', () => {
    const coach = { ...base, surface: 'coach' as const };
    expect(routeOrbSend({ ...coach, orbState: 'text_only' })).toBe('llm');
    expect(routeOrbSend({ ...coach, orbState: 'voice_out_only' })).toBe('llm');
    expect(routeOrbSend({ ...coach, orbState: 'voice_in_only' })).toBe('llm');
  });
});

// B51: coach ('left') and user-mic ('right'/'ready') amplitude merge for the
// orb's shared mic ref. Before B51, `on`/`amp` were hardwired to the
// user-mic side only, so the coach-speaking half never pulsed at all.
describe('resolveOrbMic (B51 orb voice-reactivity)', () => {
  it('coach speaking (left) with a live coach amp: on + coach amp', () => {
    expect(resolveOrbMic('left', 0.6, 0)).toEqual({ on: true, amp: 0.6 });
  });

  it('user speaking (right) with a live user amp: on + user amp', () => {
    expect(resolveOrbMic('right', 0, 0.4)).toEqual({ on: true, amp: 0.4 });
  });

  it('ready (mic armed, not yet gated to right) with a live user amp still applies it', () => {
    // This is the point-3 fix: some callers have a real user-mic amplitude
    // reading even while activeRings sits at 'ready' rather than 'right'
    // (e.g. FlowVoiceControls in full Vapi mode) — a ring-state gap must not
    // silently zero out real amplitude.
    expect(resolveOrbMic('ready', 0, 0.35)).toEqual({ on: true, amp: 0.35 });
  });

  it('left active but coach amp is 0 (not yet reporting): falls back to pre-B51 behavior', () => {
    expect(resolveOrbMic('left', 0, 0)).toEqual({ on: false, amp: 0 });
  });

  it('right active but user amp is 0: falls back, on stays true (ring alone still lights it)', () => {
    expect(resolveOrbMic('right', 0, 0)).toEqual({ on: true, amp: 0 });
  });

  it('idle: off regardless of any stray amp values', () => {
    expect(resolveOrbMic('idle', 0.5, 0.5)).toEqual({ on: false, amp: 0.5 });
  });

  it('null (no call active): off regardless of any stray amp values', () => {
    expect(resolveOrbMic(null, 0.5, 0.5)).toEqual({ on: false, amp: 0.5 });
  });

  it('left active with a live coach amp ignores a concurrent user amp (one side owns the ring)', () => {
    expect(resolveOrbMic('left', 0.7, 0.9)).toEqual({ on: true, amp: 0.7 });
  });
});

// Bug fix regression tests: the left orb reacted to Cartesia coach playback
// but stayed dead during an MP3 opener beat. Root cause was here — both
// FlowVoiceControls and OnboardingChatOverlay derived `activeRings` from
// Vapi's `isAssistantSpeaking` flag alone, which never flips true while an
// MP3 opener clip is playing (Vapi isn't talking, the MP3 element is).
// `coachSpeaking` (useCoachVoiceActivity's own `speaking` field) is the
// correct signal: it is true whenever the coachAudioBus has ANY registered
// playing element, MP3 or Cartesia, not just when Vapi's SDK reports speech.
describe('resolveActiveRings (orb dead during MP3 coach playback, bug fix)', () => {
  const base = {
    isVoiceInOnly: false,
    voiceInListening: false,
    micSpeaking: false,
    micRuntimeOn: false,
    isUserSpeaking: false,
    voiceChosen: true,
    coachSpeaking: false,
    vapiActive: false,
  };

  it('MP3 opener playing, Vapi not speaking: coachSpeaking alone lights the left ring', () => {
    // This is the exact reported scenario: Vapi never talks during an
    // MP3-only opener, so isAssistantSpeaking is false throughout, but the
    // coachAudioBus (fed by useBeatOpenerMp3) reports real playback.
    expect(resolveActiveRings({ ...base, coachSpeaking: true })).toBe('left');
  });

  it('Cartesia/Vapi speaking still lights the left ring (no regression)', () => {
    expect(resolveActiveRings({ ...base, coachSpeaking: true, vapiActive: true })).toBe('left');
  });

  it('nothing speaking, voice chosen, Vapi call live: idle', () => {
    expect(resolveActiveRings({ ...base, vapiActive: true })).toBe('idle');
  });

  it('nothing speaking, no active call: null', () => {
    expect(resolveActiveRings(base)).toBe(null);
  });

  it('voice not chosen (text-only mode): coachSpeaking does not light the ring', () => {
    expect(resolveActiveRings({ ...base, voiceChosen: false, coachSpeaking: true })).toBe(null);
  });

  it('user actively speaking wins over a stale coachSpeaking reading', () => {
    expect(
      resolveActiveRings({
        ...base,
        micRuntimeOn: true,
        isUserSpeaking: true,
        coachSpeaking: true,
      }),
    ).toBe('right');
  });

  it('voice-in-only listening mode: mic ring resolves independent of coachSpeaking', () => {
    expect(
      resolveActiveRings({
        ...base,
        isVoiceInOnly: true,
        voiceInListening: true,
        micSpeaking: true,
        coachSpeaking: true,
      }),
    ).toBe('right');
    expect(
      resolveActiveRings({
        ...base,
        isVoiceInOnly: true,
        voiceInListening: true,
        micSpeaking: false,
      }),
    ).toBe('ready');
  });
});
