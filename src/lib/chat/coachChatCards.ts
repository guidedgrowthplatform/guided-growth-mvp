import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';
import type { CheckInCardData, HabitCard } from './coachChatTypes';

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

// True when this assistant turn successfully completed a habit — drives the
// interactive Today's Habits card in the overlay.
export function messageHasHabitCompletion(m: LLMChatMessage): boolean {
  return (m.toolEvents ?? []).some(
    (evt) => evt.name === 'complete_habit' && evt.result?.ok === true,
  );
}

// True when this assistant turn pulled up TODAY's habits (query_habits with an
// explicit scope:"today") — surfaces the interactive card so the user marks
// habits in the UI during the evening check-in. A bare query (no scope) defaults
// to "all" server-side, so only an explicit "today" triggers the checklist;
// "all" (read-back) never does.
export function messageHasTodayHabits(m: LLMChatMessage): boolean {
  return (m.toolEvents ?? []).some(
    (evt) => evt.name === 'query_habits' && evt.result?.ok === true && evt.args?.scope === 'today',
  );
}

// Pull the merged DB-side check-in row out of a successful record_checkin
// tool event (the handler returns `{recorded, date, checkin: {sleep, mood,
// energy, stress}}` after the UPSERT, so partial check-ins show the right
// merged values — not just whatever subset the LLM passed in args).
function checkinFromEvent(evt: LLMToolEvent): CheckInCardData | null {
  if (evt.name !== 'record_checkin') return null;
  if (!evt.result?.ok) return null;
  const payload = evt.result.payload as { result?: Record<string, unknown> } | undefined;
  const r = payload?.result;
  if (!r) return null;
  const checkin = r.checkin as
    | Partial<Record<'sleep' | 'mood' | 'energy' | 'stress', unknown>>
    | undefined;
  const date = typeof r.date === 'string' ? r.date : '';
  if (!checkin || !date) return null;
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  return {
    sleep: num(checkin.sleep),
    mood: num(checkin.mood),
    energy: num(checkin.energy),
    stress: num(checkin.stress),
    date,
  };
}

// Last successful record_checkin in this message wins (a single turn rarely
// fires more than once, but COALESCE on the server means the latest is
// authoritative anyway).
export function buildCheckinCard(m: LLMChatMessage): CheckInCardData | undefined {
  let latest: CheckInCardData | undefined;
  for (const evt of m.toolEvents ?? []) {
    const card = checkinFromEvent(evt);
    if (card) latest = card;
  }
  return latest;
}
