import { describe, expect, it } from 'vitest';
import type { VoiceMessage } from '@/contexts/useOnboardingVoiceSession';
import { applyStartThread } from '../applyStartThread';

const msg = (id: string, text: string): VoiceMessage => ({
  id,
  role: 'ai',
  text,
});

describe('applyStartThread', () => {
  it('replace mode swaps prev for initial even when prev is non-empty', () => {
    const prev = [msg('p1', 'prev')];
    const initial = [msg('i1', 'init')];
    expect(applyStartThread(prev, initial, 'replace')).toBe(initial);
  });

  it('append-if-empty returns initial when prev is empty', () => {
    const initial = [msg('i1', 'init')];
    expect(applyStartThread([], initial, 'append-if-empty')).toBe(initial);
  });

  it('append-if-empty preserves prev when non-empty', () => {
    const prev = [msg('p1', 'prev')];
    const initial = [msg('i1', 'init')];
    expect(applyStartThread(prev, initial, 'append-if-empty')).toBe(prev);
  });
});
