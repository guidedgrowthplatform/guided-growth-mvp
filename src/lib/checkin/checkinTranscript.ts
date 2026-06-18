// Pure mapping from the stage machine to scripted coach bubbles. No React, no
// randomness beyond pickVariation's deterministic-per-day choice — so the
// transcript is a stable function of (mode, visited stages, day). Unit-testable.
import type { ChatMessage } from '@/lib/chat/coachChatTypes';
import type { CheckinMode, CheckinStage } from './checkinFlowMachine';
import { type CheckinStageKey, pickVariation } from './scriptLibrary';

// The scripted line(s) the coach speaks/shows on ENTERING a stage.
export function scriptKeysForStage(mode: CheckinMode, stage: CheckinStage): CheckinStageKey[] {
  switch (stage) {
    case 'state':
      return ['morning_greeting', 'morning_state_prompt'];
    case 'habits':
      return ['evening_greeting_habits', 'evening_habit_prompt'];
    case 'are_you_done':
      return ['are_you_done'];
    case 'reflect_proud':
      return ['reflection_transition', 'reflection_proud'];
    case 'reflect_forgive':
      return ['reflection_forgive'];
    case 'reflect_grateful':
      return ['reflection_grateful'];
    case 'wrap':
      return [mode === 'morning' ? 'morning_wrap' : 'evening_wrap'];
    case 'done':
      return [];
  }
}

// The interactive card attaches to the LAST line of a capture stage so it renders
// inline right under the prompt and stays visible in the scrollback.
function cardFor(stage: CheckinStage, daySeed: string): Partial<ChatMessage> {
  if (stage === 'state')
    return { checkinCard: { sleep: null, mood: null, energy: null, stress: null, date: daySeed } };
  if (stage === 'habits') return { habitReport: true };
  return {};
}

// Build the full scripted coach transcript from the ordered list of stages the
// machine has entered. Each scripted line is its own coach bubble; the capture
// card hangs off the prompt line.
export function buildCheckinTranscript(
  mode: CheckinMode,
  visitedStages: readonly CheckinStage[],
  daySeed: string,
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const stage of visitedStages) {
    const keys = scriptKeysForStage(mode, stage);
    const card = cardFor(stage, daySeed);
    keys.forEach((key, i) => {
      out.push({
        id: `scripted:${mode}:${stage}:${i}`,
        role: 'ai',
        text: pickVariation(key, daySeed),
        // attach the card to the final line of the stage
        ...(i === keys.length - 1 ? card : {}),
      });
    });
  }
  return out;
}
