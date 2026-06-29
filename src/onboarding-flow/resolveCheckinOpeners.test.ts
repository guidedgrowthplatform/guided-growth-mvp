import { describe, expect, it } from 'vitest';
import { CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import { CHECKIN_FLOWS } from './flows/checkin-flows';
import { resolveCheckinOpeners } from './resolveCheckinOpeners';

const morning = CHECKIN_FLOWS['morning-checkin-v1'];
const stateOpener = (flow: typeof morning) =>
  flow.nodes.find((n) => n.id === 'morning-state')!.voice.openerText!;

describe('resolveCheckinOpeners', () => {
  it('sets the morning state-check opener from the morning_state_prompt rotation', () => {
    const opener = stateOpener(resolveCheckinOpeners(morning));
    expect(CHECKIN_SCRIPTS.morning_state_prompt).toContain(opener);
  });

  it('leaves non-morning flows untouched (same reference)', () => {
    const evening = CHECKIN_FLOWS['evening-checkin-v1'];
    expect(resolveCheckinOpeners(evening)).toBe(evening);
  });

  it('does not mutate the source flow', () => {
    const before = stateOpener(morning);
    resolveCheckinOpeners(morning);
    expect(stateOpener(morning)).toBe(before);
  });
});
