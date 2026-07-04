import { describe, expect, it } from 'vitest';
import { engineForTurn, type EngineInputs } from '../engineForTurn';

// First direct coverage for the declared single source of truth (the orb survey
// flagged it untested). The B39 case is the load-bearing one: chat-native
// Direct-LLM turns must SPEAK replies when the voice-out half is on, because
// the published flow has no Vapi-brained beats and this branch carries every
// beat; the old hardcoded false made voice mode silently render text replies.

const base: EngineInputs = {
  inOnboarding: true,
  onChatPage: true,
  rawOrbState: 'text_only',
  voiceOn: false,
  micOn: false,
  chatVapiFlag: true,
  vapiCapableBeat: false,
  isLocalCaptureBeat: false,
  beatResolved: true,
  hasScreen: false,
};

describe('engineForTurn', () => {
  it('outside onboarding → idle', () => {
    expect(engineForTurn({ ...base, inOnboarding: false }).engine).toBe('idle');
  });

  it('local-capture beat → idle (adapter owns capture)', () => {
    expect(engineForTurn({ ...base, isLocalCaptureBeat: true }).engine).toBe('idle');
  });

  it('chat page, beat unresolved → idle (mount race stays closed)', () => {
    expect(engineForTurn({ ...base, beatResolved: false }).engine).toBe('idle');
  });

  it('vapi-capable beat + flag + voiceOn → Vapi owns it and speaks for itself', () => {
    const d = engineForTurn({ ...base, vapiCapableBeat: true, voiceOn: true });
    expect(d).toEqual({ engine: 'vapi', micSource: 'vapi', speakReplies: false });
  });

  it('B39: chat-native Direct-LLM with voice-out ON speaks replies', () => {
    const d = engineForTurn({ ...base, voiceOn: true, micOn: true });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'soniox', speakReplies: true });
  });

  it('B39: voice-out ON speaks replies even with the mic off (listen-free voice mode)', () => {
    const d = engineForTurn({ ...base, voiceOn: true, micOn: false });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'none', speakReplies: true });
  });

  it('voice-out OFF keeps chat-native replies text-only', () => {
    const d = engineForTurn({ ...base, voiceOn: false, micOn: true });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'soniox', speakReplies: false });
  });

  it('legacy routed: no screen → idle', () => {
    expect(engineForTurn({ ...base, onChatPage: false }).engine).toBe('idle');
  });

  it('legacy routed: vapi orb state → Vapi, silent replies', () => {
    const d = engineForTurn({ ...base, onChatPage: false, hasScreen: true, rawOrbState: 'vapi' });
    expect(d).toEqual({ engine: 'vapi', micSource: 'vapi', speakReplies: false });
  });

  it('legacy routed: voice_out_only speaks via Cartesia, no mic', () => {
    const d = engineForTurn({
      ...base, onChatPage: false, hasScreen: true, rawOrbState: 'voice_out_only',
    });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'none', speakReplies: true });
  });

  it('legacy routed: voice_in_only listens via Soniox, silent replies', () => {
    const d = engineForTurn({
      ...base, onChatPage: false, hasScreen: true, rawOrbState: 'voice_in_only',
    });
    expect(d).toEqual({ engine: 'direct_llm', micSource: 'soniox', speakReplies: false });
  });
});
