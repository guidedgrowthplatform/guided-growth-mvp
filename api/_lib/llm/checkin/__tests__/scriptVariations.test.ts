import { describe, expect, it } from 'vitest';
import { CHECKIN_SCRIPTS, type CheckinStageKey, pickVariation } from '../scriptVariations.js';

const STAGES = Object.keys(CHECKIN_SCRIPTS) as CheckinStageKey[];

describe('CHECKIN_SCRIPTS', () => {
  it('every stage has at least one variation', () => {
    for (const stage of STAGES) {
      expect(CHECKIN_SCRIPTS[stage].length).toBeGreaterThan(0);
    }
  });

  it('the three reflection prompts are single fixed lines', () => {
    expect(CHECKIN_SCRIPTS.reflection_proud).toEqual(['What are you proud of today?']);
    expect(CHECKIN_SCRIPTS.reflection_forgive).toEqual(['What do you forgive yourself for today?']);
    expect(CHECKIN_SCRIPTS.reflection_grateful).toEqual(['What are you grateful for today?']);
  });
});

describe('pickVariation', () => {
  it('always returns a member of the stage pool', () => {
    for (const stage of STAGES) {
      for (let i = 0; i < 50; i++) {
        expect(CHECKIN_SCRIPTS[stage]).toContain(pickVariation(stage));
      }
    }
  });

  it('covers every variation of a multi-variation stage across many draws', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 500; i++) {
      picks.add(pickVariation('morning_greeting'));
    }
    expect(picks.size).toBe(CHECKIN_SCRIPTS.morning_greeting.length);
  });

  it('single-variation stages always return their one line', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickVariation('reflection_proud')).toBe('What are you proud of today?');
    }
  });
});
