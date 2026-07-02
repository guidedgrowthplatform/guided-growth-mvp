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
});
