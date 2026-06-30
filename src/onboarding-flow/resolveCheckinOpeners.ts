import { type VoiceClip, VOICE_SCRIPTS_AUDIO } from '@/components/flow-designer/voiceScriptsAudio';
import { type CheckinStageKey, CHECKIN_SCRIPTS } from '@gg/shared/checkin/scriptVariations';
import type { FlowDocument } from './types';

// Beat node id -> rotation stage, per flow. Every opener beat rotates from its pool.
const NODE_STAGE: Record<string, CheckinStageKey> = {
  'morning-greeting': 'morning_greeting',
  'morning-state': 'morning_state_prompt',
  'morning-are-you-done': 'are_you_done',
  'morning-wrap': 'morning_wrap',
  'evening-greeting': 'evening_greeting_habits',
  'evening-habit-review': 'evening_habit_prompt',
  'evening-are-you-done': 'are_you_done',
  'evening-reflection': 'reflection_transition',
  'evening-wrap': 'evening_wrap',
};

// Last variant shown per stage, so consecutive opens don't repeat the same line.
const lastShown = new Map<CheckinStageKey, string>();

// Pick a fresh opener for the stage. Prefer the Sheet-synced audio clips
// (VOICE_SCRIPTS_AUDIO is {file, text} pairs generated from the Voice Scripts tab),
// so the MP3 the coach plays always matches the line on screen. Fall back to the
// text-only CHECKIN_SCRIPTS pool for any stage with no recorded audio (e.g. a stage
// cut from the audio bucket); those lines stay on Cartesia TTS.
function pickFresh(stage: CheckinStageKey): { text: string; audioUrl?: string } {
  const clips = VOICE_SCRIPTS_AUDIO[stage] as readonly VoiceClip[] | undefined;
  if (clips && clips.length > 0) {
    const fresh = clips.filter((c) => c.text !== lastShown.get(stage));
    const usable = fresh.length > 0 ? fresh : clips;
    const choice = usable[Math.floor(Math.random() * usable.length)];
    lastShown.set(stage, choice.text);
    return { text: choice.text, audioUrl: choice.file };
  }
  const pool = CHECKIN_SCRIPTS[stage];
  const fresh = pool.filter((v) => v !== lastShown.get(stage));
  const usable = fresh.length > 0 ? fresh : pool;
  const choice = usable[Math.floor(Math.random() * usable.length)];
  lastShown.set(stage, choice);
  return { text: choice };
}

// Rewrite each opener beat's openerText (and openerAudioUrl, when the line is
// recorded) from its rotation pool. Applies to both the morning and evening flows.
export function resolveCheckinOpeners(flow: FlowDocument): FlowDocument {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      const stage = NODE_STAGE[n.id];
      if (!stage) return n;
      const picked = pickFresh(stage);
      return {
        ...n,
        voice: { ...n.voice, openerText: picked.text, openerAudioUrl: picked.audioUrl },
      };
    }),
  };
}
