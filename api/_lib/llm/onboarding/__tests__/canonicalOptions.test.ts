import { describe, it, expect } from 'vitest';
import { buildCanonicalOptionsBlock } from '../canonicalOptions.js';

describe('buildCanonicalOptionsBlock', () => {
  it('scopes goal options to the chosen category (BEGINNER-02)', () => {
    const out = buildCanonicalOptionsBlock('ONBOARD-BEGINNER-02', { category: 'Sleep better' });
    expect(out).toContain('Goal Options (category: Sleep better)');
    expect(out).toContain(
      'Fall asleep earlier | Wake up earlier | Sleep more consistently | Sleep more deeply',
    );
    expect(out).toContain('never invent');
    expect(out).not.toContain('Walk more');
  });

  it('lists all categories when none chosen yet (BEGINNER-02)', () => {
    const out = buildCanonicalOptionsBlock('ONBOARD-BEGINNER-02', {});
    expect(out).toContain('Sleep better:');
    expect(out).toContain('Move more:');
  });

  it('scopes habit options to the chosen goals (BEGINNER-03)', () => {
    const out = buildCanonicalOptionsBlock('ONBOARD-BEGINNER-03', {
      category: 'Sleep better',
      goals: ['Fall asleep earlier'],
    });
    expect(out).toContain('Habit Options by Goal');
    expect(out).toContain('Fall asleep earlier: No caffeine after 2 PM');
    expect(out).not.toContain('Wake up earlier:');
  });

  it('falls back to the category goals when no goals captured yet (BEGINNER-03)', () => {
    const out = buildCanonicalOptionsBlock('ONBOARD-BEGINNER-03', { category: 'Move more' });
    expect(out).toContain('Walk more:');
  });

  it('returns empty for BEGINNER-03 with neither goals nor category', () => {
    expect(buildCanonicalOptionsBlock('ONBOARD-BEGINNER-03', {})).toBe('');
  });

  it('returns empty for unrelated screens', () => {
    expect(buildCanonicalOptionsBlock('ONBOARD-01--FORM', { category: 'Sleep better' })).toBe('');
  });
});
