import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';
import type { HabitCard } from './coachChatTypes';

// suggest_habit returns a name only — default to weekdays.
export const DEFAULT_WEEK: ReadonlyArray<boolean> = [false, true, true, true, true, true, false];

function toWeek(days: unknown): boolean[] {
  return Array.isArray(days) && days.length === 7 && days.every((d) => typeof d === 'boolean')
    ? (days as boolean[])
    : [...DEFAULT_WEEK];
}

export function cardFromEvent(evt: LLMToolEvent): HabitCard | null {
  if (!evt.result?.ok) return null;
  const payload = evt.result.payload as { result?: Record<string, unknown> } | undefined;
  const r = payload?.result;
  if (!r) return null;
  if (evt.name === 'create_habit' || evt.name === 'update_habit') {
    const habit = r.habit as { name?: string; days?: unknown } | undefined;
    if (!habit?.name) return null;
    return { name: habit.name, days: toWeek(habit.days) };
  }
  if (evt.name === 'suggest_habit') {
    if (typeof r.suggestion !== 'string') return null;
    return { name: r.suggestion, days: [...DEFAULT_WEEK] };
  }
  return null;
}

// Build the habit cards for one assistant message, applying any local day overrides
// (keyed `${messageId}:${cardIndex}`).
export function buildHabitCards(
  m: LLMChatMessage,
  overrides: Map<string, boolean[]>,
): HabitCard[] | undefined {
  const cards: HabitCard[] = [];
  for (const evt of m.toolEvents ?? []) {
    const card = cardFromEvent(evt);
    if (!card) continue;
    const override = overrides.get(`${m.id}:${cards.length}`);
    cards.push(override ? { ...card, days: override } : card);
  }
  return cards.length ? cards : undefined;
}
