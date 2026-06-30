import { describe, expect, it } from 'vitest';
import { toolSaveFor } from './flowMachine';
import { morningCheckinV1 } from './flows/checkin-flows';

const stateBeat = morningCheckinV1.nodes.find((n) => n.id === 'morning-state');
const greetingBeat = morningCheckinV1.nodes.find((n) => n.id === 'morning-greeting');

describe('toolSaveFor', () => {
  it('returns the tool for a tool-bearing beat on a save (tap)', () => {
    expect(toolSaveFor(stateBeat, true)).toEqual({ toolName: 'record_checkin' });
  });

  it('returns null when save is false (coach-driven advance)', () => {
    expect(toolSaveFor(stateBeat, false)).toBeNull();
  });

  it('returns null for a beat with no tool', () => {
    expect(toolSaveFor(greetingBeat, true)).toBeNull();
  });

  it('returns null for an undefined node', () => {
    expect(toolSaveFor(undefined, true)).toBeNull();
  });
});
