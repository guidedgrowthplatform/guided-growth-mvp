import { describe, expect, it } from 'vitest';
import { mergeThreadMessages } from './onboardingThreadMerge';
import type { VoiceMessage } from './useOnboardingVoiceSession';

const msg = (id: string, role: 'ai' | 'user', text: string, screenId?: string): VoiceMessage => ({
  id,
  role,
  text,
  screenId,
});

describe('mergeThreadMessages (B6: hydration must never drop live turns)', () => {
  it('returns the other side when one is empty', () => {
    const live = [msg('a', 'user', 'hi')];
    expect(mergeThreadMessages([], live)).toEqual(live);
    const hydrated = [msg('b', 'ai', 'hello')];
    expect(mergeThreadMessages(hydrated, [])).toEqual(hydrated);
  });

  it('keeps live turns the server does not know yet (the old rule dropped them)', () => {
    const hydrated = [
      msg('opener-S1', 'ai', 'Welcome back.', 'S1'),
      msg('vapi-user-1', 'user', 'Hey.', 'S1'),
      msg('opener-S2', 'ai', 'Next beat.', 'S2'),
    ];
    // live thread is SHORTER but holds an unmirrored turn: must survive.
    const live = [msg('vapi-user-9', 'user', 'Just said this.', 'S2')];
    const merged = mergeThreadMessages(hydrated, live);
    expect(merged.map((m) => m.id)).toEqual([
      'opener-S1',
      'vapi-user-1',
      'opener-S2',
      'vapi-user-9',
    ]);
  });

  it('prefers the fresher (longer) live copy of a shared turn', () => {
    const hydrated = [msg('vapi-ai-1', 'ai', 'Partial rep', 'S1')];
    const live = [msg('vapi-ai-1', 'ai', 'Partial reply that kept growing', 'S1')];
    expect(mergeThreadMessages(hydrated, live)[0].text).toBe(
      'Partial reply that kept growing',
    );
  });

  it('keeps the server copy when it is fuller than the live one', () => {
    const hydrated = [msg('vapi-ai-1', 'ai', 'The full stored reply', 'S1')];
    const live = [msg('vapi-ai-1', 'ai', 'The full', 'S1')];
    expect(mergeThreadMessages(hydrated, live)[0].text).toBe('The full stored reply');
  });

  it('does not duplicate shared ids', () => {
    const shared = msg('opener-S1', 'ai', 'Welcome.', 'S1');
    const merged = mergeThreadMessages([shared], [shared, msg('u1', 'user', 'hi', 'S1')]);
    expect(merged.filter((m) => m.id === 'opener-S1')).toHaveLength(1);
    expect(merged).toHaveLength(2);
  });
});
