import { describe, expect, it } from 'vitest';
import { CHECKIN_SCRIPTS, hasStateIntroCopy } from '@gg/shared/checkin/scriptVariations';
import { CHECKIN_FLOWS } from './flows/checkin-flows';
import { buildMorningStateOpener, resolveCheckinOpeners } from './resolveCheckinOpeners';

const morning = CHECKIN_FLOWS['morning-checkin-v1'];
const stateOpener = (flow: typeof morning) =>
  flow.nodes.find((n) => n.id === 'morning-state')!.voice.openerText!;

describe('buildMorningStateOpener', () => {
  it('intro present: two lines joined by a blank line, introShown true', () => {
    expect(buildMorningStateOpener({ intro: 'why', ask: 'how' })).toEqual({
      openerText: 'why\n\nhow',
      introShown: true,
    });
  });

  it('no intro: ask alone, introShown false', () => {
    expect(buildMorningStateOpener({ intro: null, ask: 'how' })).toEqual({
      openerText: 'how',
      introShown: false,
    });
  });
});

describe('resolveCheckinOpeners', () => {
  // state_intro ships as a placeholder today, so the intro is gated OFF: even first
  // run yields the ask alone. Flips to the two-bubble path once real copy lands.
  it('intro gated off while copy is a placeholder (no placeholder ever rendered)', () => {
    expect(hasStateIntroCopy()).toBe(false);
    const { flow, introShown } = resolveCheckinOpeners(morning, { firstRun: true });
    const opener = stateOpener(flow);
    expect(introShown).toBe(false);
    expect(opener).not.toContain('\n\n');
    expect(CHECKIN_SCRIPTS.morning_state_prompt).toContain(opener);
  });

  it('later runs: a single morning_state_prompt line', () => {
    const { flow, introShown } = resolveCheckinOpeners(morning, { firstRun: false });
    expect(introShown).toBe(false);
    expect(CHECKIN_SCRIPTS.morning_state_prompt).toContain(stateOpener(flow));
  });

  it('leaves non-morning flows untouched (same reference)', () => {
    const evening = CHECKIN_FLOWS['evening-checkin-v1'];
    const { flow, introShown } = resolveCheckinOpeners(evening, { firstRun: true });
    expect(flow).toBe(evening);
    expect(introShown).toBe(false);
  });

  it('does not mutate the source flow', () => {
    const before = stateOpener(morning);
    resolveCheckinOpeners(morning, { firstRun: true });
    expect(stateOpener(morning)).toBe(before);
  });
});
