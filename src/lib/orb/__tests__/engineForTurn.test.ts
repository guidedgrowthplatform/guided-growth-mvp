import { describe, expect, it } from 'vitest';
import { engineForTurn, type EngineInputs } from '../engineForTurn';

const base: EngineInputs = {
  inOnboarding: true,
  onChatPage: true,
  rawOrbState: 'text_only',
  voiceOn: false,
  micOn: false,
  chatVapiFlag: true,
  vapiCapableBeat: true,
  beatResolved: true,
  hasScreen: true,
};

describe('engineForTurn — chat page', () => {
  it('idle until the beat resolves (kills the mount race)', () => {
    const d = engineForTurn({
      ...base,
      beatResolved: false,
      rawOrbState: 'vapi',
      voiceOn: true,
      micOn: true,
    });
    expect(d.engine).toBe('idle');
    expect(d.micSource).toBe('none');
  });

  it('both orbs on + capable beat + flag → Vapi only, Vapi owns mic, no Cartesia', () => {
    const d = engineForTurn({ ...base, rawOrbState: 'vapi', voiceOn: true, micOn: true });
    expect(d).toEqual({ engine: 'vapi', micSource: 'vapi', speakReplies: false });
  });

  it('voice ON + mic NOT granted on a capable beat → Vapi (pending mic), NOT Direct-LLM', () => {
    // The key fix: the opener must never be written by Direct-LLM on a Vapi beat.
    const d = engineForTurn({
      ...base,
      rawOrbState: 'voice_out_only',
      voiceOn: true,
      micOn: false,
    });
    expect(d).toEqual({ engine: 'vapi', micSource: 'vapi', speakReplies: false });
  });

  it('voice on but NON-capable beat → Direct-LLM (no Vapi)', () => {
    const d = engineForTurn({
      ...base,
      rawOrbState: 'vapi',
      voiceOn: true,
      micOn: true,
      vapiCapableBeat: false,
    });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'soniox', speakReplies: false });
  });

  it('voice on + capable beat but flag OFF → Direct-LLM', () => {
    const d = engineForTurn({
      ...base,
      rawOrbState: 'vapi',
      voiceOn: true,
      micOn: true,
      chatVapiFlag: false,
    });
    expect(d.engine).toBe('direct_llm');
    expect(d.micSource).toBe('soniox');
  });

  it('mic only (voice off) → Direct-LLM + Soniox, no Cartesia', () => {
    const d = engineForTurn({ ...base, rawOrbState: 'voice_in_only', voiceOn: false, micOn: true });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'soniox', speakReplies: false });
  });

  it('both off → Direct-LLM text only', () => {
    const d = engineForTurn({ ...base, rawOrbState: 'text_only', voiceOn: false, micOn: false });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'none', speakReplies: false });
  });
});

describe('engineForTurn — routed screens (legacy parity)', () => {
  const routed: EngineInputs = { ...base, onChatPage: false };

  it('both orbs on → Vapi', () => {
    expect(
      engineForTurn({ ...routed, rawOrbState: 'vapi', voiceOn: true, micOn: true }).engine,
    ).toBe('vapi');
  });

  it('voice_in_only → Direct-LLM + Soniox, no Cartesia', () => {
    expect(engineForTurn({ ...routed, rawOrbState: 'voice_in_only', micOn: true })).toEqual({
      engine: 'direct_llm',
      micSource: 'soniox',
      speakReplies: false,
    });
  });

  it('voice_out_only → Direct-LLM + Cartesia (speakReplies true)', () => {
    expect(engineForTurn({ ...routed, rawOrbState: 'voice_out_only', voiceOn: true })).toEqual({
      engine: 'direct_llm',
      micSource: 'none',
      speakReplies: true,
    });
  });

  it('text_only → Direct-LLM text', () => {
    expect(engineForTurn({ ...routed, rawOrbState: 'text_only' }).engine).toBe('direct_llm');
  });

  it('no screen → idle', () => {
    expect(
      engineForTurn({ ...routed, hasScreen: false, rawOrbState: 'vapi', voiceOn: true }).engine,
    ).toBe('idle');
  });
});

describe('engineForTurn — mutual exclusion invariant', () => {
  it('never returns micSource soniox while engine is vapi', () => {
    const combos: Array<Partial<EngineInputs>> = [
      { onChatPage: true, rawOrbState: 'vapi', voiceOn: true, micOn: true, vapiCapableBeat: true },
      { onChatPage: true, rawOrbState: 'voice_out_only', voiceOn: true, micOn: false },
      { onChatPage: false, rawOrbState: 'vapi', voiceOn: true, micOn: true },
    ];
    for (const c of combos) {
      const d = engineForTurn({ ...base, ...c });
      if (d.engine === 'vapi') expect(d.micSource).not.toBe('soniox');
    }
  });
});
