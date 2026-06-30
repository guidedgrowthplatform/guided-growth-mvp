import { describe, expect, it } from 'vitest';
import { VOICE_SCRIPTS_AUDIO } from '@/components/flow-designer/voiceScriptsAudio';
import { type CheckinStageKey, CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import { CHECKIN_FLOWS } from './flows/checkin-flows';
import { resolveCheckinOpeners } from './resolveCheckinOpeners';

const morning = CHECKIN_FLOWS['morning-checkin-v1'];
const evening = CHECKIN_FLOWS['evening-checkin-v1'];

// morning-state is intentionally absent: it has no combined opener now. The
// state-check adapter plays the four per-element lines itself and reveals each row.
const NODE_STAGE: Record<string, CheckinStageKey> = {
  'morning-greeting': 'morning_greeting',
  'morning-are-you-done': 'are_you_done',
  'morning-wrap': 'morning_wrap',
  'evening-greeting': 'evening_greeting_habits',
  'evening-habit-review': 'evening_habit_prompt',
  'evening-are-you-done': 'are_you_done',
  'evening-reflection': 'reflection_transition',
  'evening-wrap': 'evening_wrap',
};

// The resolver prefers the Sheet-synced audio clips; falls back to the text pool.
const allowed = (stage: CheckinStageKey): string[] => {
  const clips = VOICE_SCRIPTS_AUDIO[stage];
  return clips && clips.length ? clips.map((c) => c.text) : [...CHECKIN_SCRIPTS[stage]];
};

const openerOf = (flow: typeof morning, id: string) =>
  flow.nodes.find((n) => n.id === id)!.voice.openerText!;

describe('resolveCheckinOpeners', () => {
  it('rotates every mapped opener beat from its pool, in both flows', () => {
    for (const flow of [morning, evening]) {
      const resolved = resolveCheckinOpeners(flow);
      for (const [id, stage] of Object.entries(NODE_STAGE)) {
        if (!flow.nodes.some((n) => n.id === id)) continue;
        expect(allowed(stage)).toContain(openerOf(resolved, id));
      }
    }
  });

  it('does not return the same variant on consecutive opens when the pool has options', () => {
    expect(allowed('morning_greeting').length).toBeGreaterThan(1);
    const a = openerOf(resolveCheckinOpeners(morning), 'morning-greeting');
    const b = openerOf(resolveCheckinOpeners(morning), 'morning-greeting');
    expect(b).not.toBe(a);
  });

  it('does not mutate the source flow', () => {
    const before = openerOf(morning, 'morning-greeting');
    resolveCheckinOpeners(morning);
    expect(openerOf(morning, 'morning-greeting')).toBe(before);
  });
});
