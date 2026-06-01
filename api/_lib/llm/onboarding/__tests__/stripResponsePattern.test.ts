import { describe, it, expect } from 'vitest';
import { stripResponsePattern } from '../stripResponsePattern.js';

const FORK_BLOCK = `BEHAVIOR: Ask if they've tracked habits before. Route based on answer.
NEXT: New -> ONBOARD-BEGINNER-01. Experienced -> ONBOARD-ADVANCED-01.

--- SUPPLEMENTARY ---

EXPECTED USER RESPONSE:
NEW: 'I'm new to this'

AI RESPONSE PATTERN:
IF NEW: 'That's great. The fact that you're here means something.'

IF EXPERIENCED: 'Nice - just read them to me one by one. Tell me the name, how often, what time.'

SYSTEM ACTION:
1. Parse intent: new vs experienced
2. Navigate to next screen

EDGE CASES:
AMBIGUOUS: 'Would you like me to guide you step by step?'`;

describe('stripResponsePattern', () => {
  it('removes the AI RESPONSE PATTERN section', () => {
    const out = stripResponsePattern(FORK_BLOCK);
    expect(out).not.toContain('AI RESPONSE PATTERN:');
    expect(out).not.toContain('read them to me one by one');
    expect(out).not.toContain('IF EXPERIENCED');
  });

  it('keeps the surrounding BEHAVIOR / SYSTEM ACTION / EDGE CASES sections', () => {
    const out = stripResponsePattern(FORK_BLOCK);
    expect(out).toContain('BEHAVIOR: Ask if they');
    expect(out).toContain('EXPECTED USER RESPONSE:');
    expect(out).toContain('SYSTEM ACTION:');
    expect(out).toContain('EDGE CASES:');
  });

  it('handles SYSTEM ACTIONS (plural) as the boundary', () => {
    const block = `AI RESPONSE PATTERN:\nSELECTED: 'Solid.'\n\nSYSTEM ACTIONS:\n1. Save`;
    const out = stripResponsePattern(block);
    expect(out).not.toContain('AI RESPONSE PATTERN:');
    expect(out).toContain('SYSTEM ACTIONS:');
  });

  it('leaves a block without AI RESPONSE PATTERN untouched (fail-open)', () => {
    const block = `BEHAVIOR: do the thing\n\nSYSTEM ACTION:\n1. go`;
    expect(stripResponsePattern(block)).toBe(block);
  });

  it('does not collapse content when there is no SYSTEM ACTION boundary', () => {
    const block = `BEHAVIOR: x\n\nAI RESPONSE PATTERN:\nIF NEW: 'hi'`;
    expect(stripResponsePattern(block)).toBe(block);
  });
});
