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
  it('is deterministic for a given (stage, day)', () => {
    for (const stage of STAGES) {
      const a = pickVariation(stage, '2026-06-18');
      const b = pickVariation(stage, '2026-06-18');
      expect(a).toBe(b);
      expect(CHECKIN_SCRIPTS[stage]).toContain(a);
    }
  });

  it('rotates across days for a multi-variation stage', () => {
    const picks = new Set<string>();
    for (let d = 1; d <= 14; d++) {
      picks.add(pickVariation('morning_greeting', `2026-06-${String(d).padStart(2, '0')}`));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('single-variation stages always return their one line', () => {
    for (const day of ['2026-01-01', '2026-07-04', '2026-12-31']) {
      expect(pickVariation('reflection_proud', day)).toBe('What are you proud of today?');
    }
  });
});
