import { describe, expect, it } from 'vitest';
import { getBeatContext, getBeatAllowedTools } from '../beatContexts.js';

// Guards the tool-gate overlay: allowedTools come from the flow builder via
// onboarding_combined.json; context/opener prose is left untouched.
describe('beatContexts tool-gate overlay (from onboarding_combined.json)', () => {
  it('takes allowedTools from the export (ONBOARD-COMPLETE gains update_habit)', () => {
    expect(getBeatAllowedTools('ONBOARD-COMPLETE')).toEqual(['update_habit', 'confirm_plan']);
  });

  it('sources the interactive beats tools from the export', () => {
    expect(getBeatAllowedTools('ONBOARD-STATE-CHECK')).toEqual(['record_checkin', 'advance_step']);
    expect(getBeatAllowedTools('ONBOARD-MORNING-SETUP')).toEqual([
      'submit_morning_checkin',
      'advance_step',
    ]);
  });

  it('leaves the coach context prose untouched (no appended lines)', () => {
    const beat = getBeatContext('ONBOARD-STATE-CHECK');
    expect(beat!.context).not.toContain('Ask for each in order');
    expect(beat!.context).not.toContain('ALREADY SPOKEN');
  });

  it('leaves an export-absent beat resolving from BEAT_CONTEXTS', () => {
    const beat = getBeatContext('ONBOARD-AUTH--FORM');
    expect(beat).toBeDefined();
    expect(beat!.context).toContain('BEAT: Auth.');
    expect(beat!.allowedTools).toEqual([]);
  });

  // B50: check-in setup got misrouted into habit-creation tool calls and tripped
  // max_habits_reached ("habit limit reached") even though the user was describing
  // check-in content, not adding a habit. The habit-schedule beats (ONBOARD-BEGINNER-
  // 04/05) kept add_habit allowed "for a new one named mid-beat", which is exactly
  // the hole that let check-in-metric descriptions get misread as a new habit named
  // "daily check-in". Neither beat's job is creating habits (that is
  // ONBOARD-BEGINNER-03), so add_habit is dropped from both.
  it('B50: habit-schedule beats (04/05) do not expose add_habit', () => {
    expect(getBeatAllowedTools('ONBOARD-BEGINNER-04')).toEqual(['update_habit', 'advance_step']);
    expect(getBeatAllowedTools('ONBOARD-BEGINNER-05')).toEqual(['update_habit', 'advance_step']);
  });

  // B50 defense-in-depth: the beats a check-in description could plausibly land on
  // must never expose a habit-creation tool, structurally, regardless of prompt text.
  it('B50: no check-in-adjacent beat exposes a habit-creation tool', () => {
    const CHECKIN_ADJACENT_BEATS = [
      'ONBOARD-STATE-CHECK',
      'ONBOARD-MORNING-SETUP',
      'ONBOARD-BEGINNER-04',
      'ONBOARD-BEGINNER-05',
    ];
    for (const screenId of CHECKIN_ADJACENT_BEATS) {
      const tools = getBeatAllowedTools(screenId) ?? [];
      expect(tools).not.toContain('add_habit');
    }
  });
});
