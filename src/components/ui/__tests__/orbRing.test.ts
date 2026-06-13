import { describe, expect, it } from 'vitest';
import { deriveOrbRing } from '../orbRing';

const base = {
  voiceOn: false,
  micOn: false,
  speaking: false,
  listening: false,
  micSpeaking: false,
};

describe('deriveOrbRing', () => {
  it('returns null when both halves are off', () => {
    expect(deriveOrbRing(base)).toBeNull();
  });

  it('speaking wins over everything when voice is on', () => {
    expect(
      deriveOrbRing({ ...base, voiceOn: true, micOn: true, speaking: true, listening: true }),
    ).toBe('left');
  });

  it('does not show left when voice is off even if speaking', () => {
    expect(deriveOrbRing({ ...base, micOn: true, speaking: true, listening: true })).toBe('ready');
  });

  it('shows right when mic is capturing detected speech', () => {
    expect(deriveOrbRing({ ...base, micOn: true, listening: true, micSpeaking: true })).toBe(
      'right',
    );
  });

  it('shows idle when both halves on and nothing is happening', () => {
    expect(deriveOrbRing({ ...base, voiceOn: true, micOn: true })).toBe('idle');
  });

  it('shows ready when only mic is on and listening, no speech yet', () => {
    expect(deriveOrbRing({ ...base, micOn: true, listening: true })).toBe('ready');
  });

  it('idle outranks ready when both halves on but not yet listening', () => {
    expect(deriveOrbRing({ ...base, voiceOn: true, micOn: true, listening: false })).toBe('idle');
  });
});
