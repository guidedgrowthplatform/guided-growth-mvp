import { describe, expect, it } from 'vitest';
import { getBeatContext, getBeatAllowedTools } from '../beatContexts.js';

// Guards the Export-driven overlay: allowedTools + spoken/per-element lines come
// from flowBeatMeta.generated.json; prose stays from the hand-authored base.
describe('beatContexts export overlay', () => {
  it('folds the per-element ask order into an export-backed beat', () => {
    const beat = getBeatContext('ONBOARD-STATE-CHECK');
    expect(beat).toBeDefined();
    expect(beat!.context).toContain('Ask for each in order:');
    expect(beat!.context).toContain('How did you sleep?');
    // sleep before stress (authored order)
    expect(beat!.context.indexOf('How did you sleep?')).toBeLessThan(
      beat!.context.indexOf('your stress?'),
    );
  });

  it('labels the already-spoken opener so the coach does not repeat it', () => {
    const beat = getBeatContext('ONBOARD-01--FORM');
    expect(beat!.context).toContain('ALREADY SPOKEN');
  });

  it('takes allowedTools from the export (ONBOARD-COMPLETE gains update_habit)', () => {
    expect(getBeatAllowedTools('ONBOARD-COMPLETE')).toEqual(['update_habit', 'confirm_plan']);
  });

  it('preserves the synced prose base for the completion beat', () => {
    // Synced overlay makes ONBOARD-COMPLETE a plan-confirm, coherent with the
    // export spoken line + update_habit gate.
    const beat = getBeatContext('ONBOARD-COMPLETE');
    expect(beat!.context).toContain('Show the whole plan');
  });

  it('leaves an export-absent beat resolving from BEAT_CONTEXTS', () => {
    const beat = getBeatContext('ONBOARD-AUTH--FORM');
    expect(beat).toBeDefined();
    expect(beat!.context).toContain('BEAT: Auth.');
    expect(beat!.allowedTools).toEqual([]);
  });
});
