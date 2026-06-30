import { describe, expect, it } from 'vitest';
import type { FlowNode } from '@/onboarding-flow/types';
import { resolveCheckinIntent } from './useCheckinVoice';

function node(over: Partial<FlowNode>): FlowNode {
  return {
    id: 'n',
    type: 'beat',
    componentType: 'coach-bubble',
    componentProps: {},
    voice: { openerText: '', expectsInput: true, directLlmAllowed: true },
    tool: null,
    persist: null,
    ...over,
  } as unknown as FlowNode;
}

const sayOnly = (id = 'evening-greeting') => node({ id, componentType: 'coach-bubble' });
const areYouDone = () => node({ id: 'morning-are-you-done', componentType: 'coach-bubble' });
const reflection = () => node({ id: 'evening-reflection', componentType: 'reflection' });
const stateCheck = () => node({ id: 'morning-state', componentType: 'state-check' });

describe('resolveCheckinIntent', () => {
  it('data-card and reflection beats never resolve a voice intent (tap only)', () => {
    expect(resolveCheckinIntent(stateCheck(), 'done')).toBeNull();
    expect(resolveCheckinIntent(undefined, 'done')).toBeNull();
    // Reflection answers are prose — "nothing"/"quit" must NOT advance/close.
    expect(resolveCheckinIntent(reflection(), "that's all")).toBeNull();
    expect(resolveCheckinIntent(reflection(), 'nothing big today')).toBeNull();
    expect(resolveCheckinIntent(reflection(), 'I want to quit smoking')).toBeNull();
  });

  it('say-advance beat advances on a done/ready phrase', () => {
    expect(resolveCheckinIntent(sayOnly(), "I'm ready")).toBe('advance');
    expect(resolveCheckinIntent(sayOnly(), "let's go")).toBe('advance');
    expect(resolveCheckinIntent(sayOnly(), 'um not sure yet')).toBeNull();
  });

  it('are-you-done routes add->back, done->advance', () => {
    expect(resolveCheckinIntent(areYouDone(), 'add one more thing')).toBe('back');
    expect(resolveCheckinIntent(areYouDone(), 'no, move on')).toBe('advance');
  });

  it('decline closes from a say-only beat', () => {
    expect(resolveCheckinIntent(sayOnly(), 'cancel')).toBe('decline');
    expect(resolveCheckinIntent(areYouDone(), 'not now')).toBe('decline');
  });
});
