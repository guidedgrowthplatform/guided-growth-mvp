import { describe, it, expect } from 'vitest';
import { stripForwardPointers } from '../stripForwardPointers.js';

// Fixtures mirror real screen_contexts DB rows (the runtime source).
const FORK = `SCREEN_ID: ONBOARD-FORK--FORM
SCREEN_NAME: Experience Fork
ROUTE: /onboard/02

SCREEN: Experience Fork (Step 2)
STATE: User completed profile. You know their name. Vapi agent is still active from ONBOARD-01.
BEHAVIOR: Ask if they've tracked habits before. Route based on answer:
- New/first time/tried but didn't stick -> beginner path (ONBOARD-BEGINNER-01)
- Experienced/has a list/uses another app -> advanced path (ONBOARD-ADVANCED-01)
- Ambiguous ('sort of') -> clarify: 'Would you like me to guide you step by step, or do you have a list?'
IF NEW: Validate them. 'The fact that you're here means something.'
DO NOT: Make 'new' feel lesser.
NEXT: New -> ONBOARD-BEGINNER-01. Experienced -> ONBOARD-ADVANCED-01.

--- SUPPLEMENTARY ---

AI RESPONSE PATTERN:
IF EXPERIENCED: 'Just read them to me one by one. Tell me the name, how often, what time.'

SYSTEM ACTION:
2. If new: onboarding_path = 'beginner', navigate to ONBOARD-BEGINNER-01

EDGE CASES:
'I've tried but never stuck': route to beginner`;

const HOME_MORNING = `SCREEN_ID: HOME-MORNING
SCREEN_NAME: Home Morning
ROUTE: /home

SCREEN: Home (morning, before check-in)
STATE: Regular morning. User may or may not have done their check-in.
BEHAVIOR: No auto-play. If mic tapped and check-in not done, route to MCHECK-01. If check-in already done, route to voice conversation (CHAT).
DO NOT: Auto-play voice. Nag about uncompleted check-in.

--- SUPPLEMENTARY ---

VOICE INSTRUCTIONS:
[Mic tap routes to MCHECK-01 which handles the greeting.]`;

const HOME_CHECKIN = `SCREEN_ID: HOME-CHECKIN
SCREEN_NAME: Home Check-in Assistant
ROUTE: /

SCREEN: Home — always-on check-in assistant overlay.
STATE: The user opened the assistant from the home screen.
BEHAVIOR: Be a warm, concise coach. Act on clear intent with your tools. React in 1-2 sentences.
DO NOT: Guilt the user. Give speeches.

--- SUPPLEMENTARY ---

EXPECTED USER RESPONSE:
"Mark meditation done" / "I slept 4, mood 3".

CRISIS BOUNDARY:
If the user expresses self-harm or crisis, direct them to 988 (US).`;

const EDIT_REFLECTION = `SCREEN_ID: EDIT-REFLECTION-01
SCREEN_NAME: Edit Reflection (current setup)
ROUTE: /reflection/edit

User is editing their existing evening reflection setup. They previously chose a guided format with three default prompts.

--- SUPPLEMENTARY ---

SYSTEM ACTION:
Switch to custom → navigate to EDIT-REFLECTION-02.

EDGE CASES:
User says 'delete' → navigate to delete confirm.`;

describe('stripForwardPointers', () => {
  describe('FORK (the reported pre-narration screen)', () => {
    const out = stripForwardPointers(FORK);

    it('drops the NEXT line and the SUPPLEMENTARY tail', () => {
      expect(out).not.toContain('NEXT:');
      expect(out).not.toContain('--- SUPPLEMENTARY ---');
      expect(out).not.toContain('AI RESPONSE PATTERN:');
      expect(out).not.toContain('SYSTEM ACTION');
      expect(out).not.toContain('EDGE CASES:');
    });

    it('removes the next-screen ids (incl. the parenthetical leak)', () => {
      expect(out).not.toContain('ONBOARD-BEGINNER-01');
      expect(out).not.toContain('ONBOARD-ADVANCED-01');
      expect(out).not.toContain('read them to me one by one');
    });

    it('keeps current-screen coaching content', () => {
      expect(out).toContain('BEHAVIOR:');
      expect(out).toContain('DO NOT:');
      expect(out).toContain('IF NEW:');
      expect(out).toContain('beginner path');
      expect(out).toContain('advanced path');
    });

    it('preserves backward references (where the user came from)', () => {
      expect(out).toContain('from ONBOARD-01');
    });
  });

  it('scrubs inline route-to + voice tail on HOME-MORNING', () => {
    const out = stripForwardPointers(HOME_MORNING);
    expect(out).not.toContain('MCHECK-01');
    expect(out).not.toContain('VOICE INSTRUCTIONS:');
    expect(out).toContain('BEHAVIOR:');
    expect(out).toContain('No auto-play');
    expect(out).toContain('DO NOT:');
  });

  it('no-ops the clean HOME-CHECKIN block (drops only the tail)', () => {
    const out = stripForwardPointers(HOME_CHECKIN);
    expect(out).not.toContain('CRISIS BOUNDARY:');
    expect(out).not.toContain('EXPECTED USER RESPONSE:');
    expect(out).toContain('always-on check-in assistant');
    expect(out).toContain('BEHAVIOR:');
    expect(out).toContain('DO NOT:');
  });

  it('truncates EDIT-REFLECTION tail (forbidden sections below divider)', () => {
    const out = stripForwardPointers(EDIT_REFLECTION);
    expect(out).not.toContain('SYSTEM ACTION');
    expect(out).not.toContain('navigate to EDIT-REFLECTION-02');
    expect(out).not.toContain('EDGE CASES:');
    expect(out).toContain('editing their existing evening reflection');
  });

  it('is idempotent', () => {
    for (const block of [FORK, HOME_MORNING, HOME_CHECKIN, EDIT_REFLECTION]) {
      const once = stripForwardPointers(block);
      expect(stripForwardPointers(once)).toBe(once);
    }
  });

  it('leaves a minimal block essentially unchanged', () => {
    const out = stripForwardPointers('BEHAVIOR: do the thing\nDO NOT: panic');
    expect(out).toContain('BEHAVIOR: do the thing');
    expect(out).toContain('DO NOT: panic');
  });

  it('returns empty for empty input', () => {
    expect(stripForwardPointers('')).toBe('');
  });

  it('does not over-strip legitimate non-nav arrows (lowercase target)', () => {
    const out = stripForwardPointers("BEHAVIOR: 'What habit?' -> collect name, time");
    expect(out).toContain('collect name');
  });

  it('strips a parenthetical screen id embedded in prose (the FORK leak)', () => {
    const out = stripForwardPointers('BEHAVIOR: Pick the beginner path (ONBOARD-BEGINNER-01).');
    expect(out).not.toContain('ONBOARD-BEGINNER-01');
    expect(out).toContain('Pick the beginner path');
  });

  it('scrubs "navigate to SCREEN" to a neutral word', () => {
    const out = stripForwardPointers('BEHAVIOR: then navigate to HOME-FIRST now');
    expect(out).not.toContain('HOME-FIRST');
    expect(out).not.toContain('navigate to');
    expect(out).toContain('continue');
  });

  it('scrubs "route to beginner/advanced" prose', () => {
    const out = stripForwardPointers('BEHAVIOR: when unsure route to advanced first');
    expect(out).not.toContain('route to advanced');
    expect(out).toContain('continue');
  });
});
