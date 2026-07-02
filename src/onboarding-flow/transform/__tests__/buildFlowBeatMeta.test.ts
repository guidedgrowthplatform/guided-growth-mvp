import { describe, it, expect } from 'vitest';
import { buildFlowBeatMeta } from '../buildFlowBeatMeta';

const VALID = new Set(['record_checkin', 'advance_step', 'submit_profile']);

describe('buildFlowBeatMeta', () => {
  it('keys by screenId and reads context (root) + meta fields', () => {
    const { meta, errors } = buildFlowBeatMeta(
      {
        beats: [
          {
            sheetStage: 'ONBOARD-STATE-CHECK: First State Check',
            context: 'BEAT: state.',
            meta: {
              spokenContent: 'How are you landing?',
              allowedTools: 'record_checkin, advance_step',
              perElement: [
                { elementId: 'mood', line: "How's your mood?", order: 2 },
                { elementId: 'sleep', line: 'How did you sleep?', order: 1 },
              ],
            },
          },
        ],
      },
      VALID,
    );
    expect(errors).toEqual([]);
    const beat = meta['ONBOARD-STATE-CHECK'];
    expect(beat.context).toBe('BEAT: state.');
    expect(beat.spokenContent).toBe('How are you landing?');
    expect(beat.allowedTools).toEqual(['record_checkin', 'advance_step']);
    // perElement sorted by order
    expect(beat.perElement.map((e) => e.elementId)).toEqual(['sleep', 'mood']);
  });

  it('skips beats with empty/missing sheetStage', () => {
    const { meta } = buildFlowBeatMeta(
      {
        beats: [
          { sheetStage: '', context: 'x', meta: {} },
          { context: 'y', meta: {} },
        ],
      },
      VALID,
    );
    expect(Object.keys(meta)).toEqual([]);
  });

  it('flags unknown tool names as errors', () => {
    const { errors } = buildFlowBeatMeta(
      {
        beats: [
          {
            sheetStage: 'ONBOARD-01--FORM: Profile',
            meta: { allowedTools: 'submit_profile, bogus_tool' },
          },
        ],
      },
      VALID,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('bogus_tool');
  });

  it('last-wins + warns on duplicate screenId', () => {
    const { meta, warnings } = buildFlowBeatMeta(
      {
        beats: [
          { sheetStage: 'ONBOARD-01--FORM: A', context: 'first', meta: {} },
          { sheetStage: 'ONBOARD-01--FORM: B', context: 'second', meta: {} },
        ],
      },
      VALID,
    );
    expect(meta['ONBOARD-01--FORM'].context).toBe('second');
    expect(warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('omits spokenContent when absent', () => {
    const { meta } = buildFlowBeatMeta(
      { beats: [{ sheetStage: 'ONBOARD-01--FORM: P', context: 'c', meta: {} }] },
      VALID,
    );
    expect(meta['ONBOARD-01--FORM'].spokenContent).toBeUndefined();
    expect(meta['ONBOARD-01--FORM'].perElement).toEqual([]);
  });
});
