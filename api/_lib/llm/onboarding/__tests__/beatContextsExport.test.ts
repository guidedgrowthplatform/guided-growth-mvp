import { describe, expect, it } from 'vitest';
import { getBeatContext, getBeatAllowedTools } from '../beatContexts.js';

// Guards the tool-gate overlay: allowedTools come from the flow builder via
// onboarding_combined.json; context/opener prose is left untouched.
describe('beatContexts tool-gate overlay (from onboarding_combined.json)', () => {
  // Ruling 2026-07-07: ONBOARD-COMPLETE is the plan-review/confirm screen,
  // where full habit editing (add, remove, change frequency) lives.
  it('takes allowedTools from the export (ONBOARD-COMPLETE gains full habit editing)', () => {
    expect(getBeatAllowedTools('ONBOARD-COMPLETE')).toEqual([
      'add_habit',
      'remove_habit',
      'update_habit',
      'confirm_plan',
    ]);
  });

  it('sources the interactive beats tools from the export', () => {
    expect(getBeatAllowedTools('ONBOARD-STATE-CHECK')).toEqual(['record_checkin', 'advance_step']);
    expect(getBeatAllowedTools('ONBOARD-MORNING-SETUP')).toEqual([
      'submit_morning_checkin',
      'advance_step',
    ]);
  });

  // F10 layer 2: add_habit used to be reachable on this beat as a fallback
  // for setting days, but this beat's only job is scheduling ALREADY-captured
  // habits (update_habit). A reachable add_habit here let the coach silently
  // inject an ungrounded/fabricated habit name into habitConfigs alongside (or
  // effectively replacing, once the collapsed brain-dump card was the only
  // other entry) the real captured one — observed live as the brain-dump
  // habit swapping to an unrelated, never-typed name ("No screens after
  // 10 PM") by the time the real Home screen rendered.
  it('never exposes add_habit on the advanced habit-days beat (F10 layer 2)', () => {
    expect(getBeatAllowedTools('ONBOARD-ADVANCED-FREQUENCY')).toEqual([
      'update_habit',
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
});
