import { describe, expect, it } from 'vitest';
import { evaluateEchoGate, type EchoGateInput } from '@/lib/voice/echoGate';

const base: EchoGateInput = {
  echoGateOn: true,
  speaking: true,
  rms: 0.02,
  minRms: 0.006,
  isFinal: false,
  textLen: 5,
  minChars: 2,
  requireFinalForLowEnergy: false,
  sustainCount: 0,
  sustainFrames: 2,
};

describe('evaluateEchoGate', () => {
  it('passes and resets when gate off', () => {
    expect(evaluateEchoGate({ ...base, echoGateOn: false, sustainCount: 5 })).toEqual({
      pass: true,
      sustainCount: 0,
    });
  });

  it('passes and resets when coach not speaking', () => {
    expect(evaluateEchoGate({ ...base, speaking: false, sustainCount: 5 })).toEqual({
      pass: true,
      sustainCount: 0,
    });
  });

  it('final passes immediately when loud', () => {
    expect(evaluateEchoGate({ ...base, isFinal: true, rms: 0.02 }).pass).toBe(true);
  });

  it('final suppressed when quiet', () => {
    expect(evaluateEchoGate({ ...base, isFinal: true, rms: 0.001 }).pass).toBe(false);
  });

  it('quiet final passes when requireFinalForLowEnergy and long enough', () => {
    const r = evaluateEchoGate({
      ...base,
      isFinal: true,
      rms: 0.001,
      requireFinalForLowEnergy: true,
      textLen: 4,
    });
    expect(r.pass).toBe(true);
  });

  it('single loud interim does not barge; second does and self-resets the count', () => {
    const first = evaluateEchoGate({ ...base, rms: 0.02, sustainCount: 0 });
    expect(first).toEqual({ pass: false, sustainCount: 1 });
    const second = evaluateEchoGate({ ...base, rms: 0.02, sustainCount: first.sustainCount });
    expect(second).toEqual({ pass: true, sustainCount: 0 });
  });

  it('a passing final self-resets the count', () => {
    expect(evaluateEchoGate({ ...base, isFinal: true, rms: 0.02, sustainCount: 1 })).toEqual({
      pass: true,
      sustainCount: 0,
    });
  });

  it('quiet interim resets the sustain count', () => {
    expect(evaluateEchoGate({ ...base, rms: 0.001, sustainCount: 1 })).toEqual({
      pass: false,
      sustainCount: 0,
    });
  });
});
