import { describe, expect, it } from 'vitest';
import { engineForTurn, type EngineInputs } from './engineForTurn';
import { orbStateFrom } from './orbState';

// Base: onboarding chat page, Vapi flag OFF, beat resolved, both orbs on.
function base(overrides: Partial<EngineInputs> = {}): EngineInputs {
  const voiceOn = overrides.voiceOn ?? true;
  const micOn = overrides.micOn ?? true;
  return {
    inOnboarding: true,
    onChatPage: true,
    rawOrbState: orbStateFrom(voiceOn, micOn),
    voiceOn,
    micOn,
    chatVapiFlag: false,
    vapiCapableBeat: false,
    isLocalCaptureBeat: false,
    beatResolved: true,
    hasScreen: true,
    ...overrides,
    // keep rawOrbState consistent with the (possibly overridden) orbs
    ...(overrides.voiceOn !== undefined || overrides.micOn !== undefined
      ? { rawOrbState: orbStateFrom(overrides.voiceOn ?? voiceOn, overrides.micOn ?? micOn) }
      : {}),
  };
}

describe('engineForTurn — onboarding chat page (T1-4: Soniox listens on beat load)', () => {
  it('both orbs on, Vapi off → Direct-LLM owns the mic via Soniox', () => {
    expect(engineForTurn(base())).toEqual({
      engine: 'direct_llm',
      micSource: 'soniox',
      speakReplies: false,
    });
  });

  it('mic toggled off → Soniox releases the mic (micSource none)', () => {
    expect(engineForTurn(base({ micOn: false })).micSource).toBe('none');
  });

  it('mic toggled back on → Soniox re-owns the mic', () => {
    expect(engineForTurn(base({ micOn: true })).micSource).toBe('soniox');
  });

  it('beat not yet resolved → IDLE (no premature arm on mount)', () => {
    expect(engineForTurn(base({ beatResolved: false })).engine).toBe('idle');
  });

  it('never speaks replies on the chat page (openers carry voice-out)', () => {
    expect(engineForTurn(base()).speakReplies).toBe(false);
  });
});

describe('engineForTurn — Vapi ownership', () => {
  it('Vapi flag on + capable beat + voice on → Vapi owns everything', () => {
    expect(engineForTurn(base({ chatVapiFlag: true, vapiCapableBeat: true }))).toEqual({
      engine: 'vapi',
      micSource: 'vapi',
      speakReplies: false,
    });
  });

  it('Vapi flag on but beat not capable → stays Direct-LLM + Soniox', () => {
    expect(engineForTurn(base({ chatVapiFlag: true, vapiCapableBeat: false })).micSource).toBe(
      'soniox',
    );
  });

  it('local-capture beat → IDLE (adapter owns capture)', () => {
    expect(engineForTurn(base({ isLocalCaptureBeat: true })).engine).toBe('idle');
  });

  it('outside onboarding → IDLE', () => {
    expect(engineForTurn(base({ inOnboarding: false })).engine).toBe('idle');
  });
});
