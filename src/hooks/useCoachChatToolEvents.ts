import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { trackCoachToolEvent } from '@/analytics/coachFunnel';
import { useSessionLog } from '@/hooks/useSessionLog';
import type { LastCreatedItem } from '@/lib/chat/coachChatTypes';
import { queryKeys } from '@/lib/query';
import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';

// Tools that mark the evening check-in as concluded (day summary / reflection log).
const EVENING_DONE_TOOLS: ReadonlySet<string> = new Set(['get_summary', 'log_reflection']);
// record_checkin marks a morning check-in concluded (a dimension was recorded).
// Per-bucket events discriminate morning vs evening, unlike the shared
// daily_checkins row which an evening save also writes (MR#2).
const MORNING_DONE_TOOLS: ReadonlySet<string> = new Set(['record_checkin']);

// Write tools — read-only (query_habits, get_summary, suggest_habit) skip refresh.
const MUTATION_TOOLS: ReadonlySet<string> = new Set([
  'create_habit',
  'complete_habit',
  'update_habit',
  'delete_habit',
  'create_metric',
  'log_metric',
  'delete_metric',
  'record_checkin',
  'start_focus',
  'log_reflection',
]);

function toolEventIds(messages: LLMChatMessage[]): string[] {
  const ids: string[] = [];
  for (const m of messages) {
    for (const evt of m.toolEvents ?? []) ids.push(evt.id);
  }
  return ids;
}

// Wire shape: useLLM wraps tool_result as { ok, payload: e.result }, and the
// server-side ok() helper already nests as { ok, result: {...} } — so the
// id lives at payload.result.habit.id, matching coachChatCards' depth.
function extractCreatedItem(evt: LLMToolEvent): LastCreatedItem | null {
  const payload = evt.result?.payload as { result?: Record<string, unknown> } | undefined;
  const r = payload?.result;
  if (!r || typeof r !== 'object') return null;
  if (evt.name === 'create_habit') {
    const habit = r.habit as { id?: unknown } | undefined;
    if (habit && typeof habit.id === 'string') return { type: 'habit', id: habit.id };
  } else if (evt.name === 'log_reflection') {
    const entryId = r.entry_id;
    if (typeof entryId === 'string') return { type: 'reflection', id: entryId };
  }
  return null;
}

// Mirrors useChatToolEvents' dedup kernel, but invalidates tracking caches
// instead of routing onboarding nav/state. Driven off the PERSISTED
// message.toolEvents (stable) — never llm.toolEvents (cleared on `done`).
export function useCoachChatToolEvents(
  messages: LLMChatMessage[],
  resetKey: string | null,
  initialMessages: LLMChatMessage[],
  screenId: string,
): LastCreatedItem | undefined {
  const qc = useQueryClient();
  const { logEvent } = useSessionLog();
  const firedIdsRef = useRef<Set<string>>(new Set());
  const eveningDoneEmittedRef = useRef(false);
  const morningDoneEmittedRef = useRef(false);
  const [lastCreatedItem, setLastCreatedItem] = useState<LastCreatedItem | undefined>(undefined);

  // Reset on session change; pre-seed with resumed-history ids so a
  // time-windowed resume doesn't re-invalidate old writes on mount.
  useEffect(() => {
    firedIdsRef.current = new Set(toolEventIds(initialMessages));
    eveningDoneEmittedRef.current = false;
    morningDoneEmittedRef.current = false;
    setLastCreatedItem(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    let mutated = false;
    let newlyCreated: LastCreatedItem | null = null;
    const onEvening = screenId.startsWith('ECHECK');
    const onMorning = screenId.startsWith('MCHECK');
    for (const m of messages) {
      for (const evt of m.toolEvents ?? []) {
        if (!evt.result?.ok) continue;
        if (firedIdsRef.current.has(evt.id)) continue;
        firedIdsRef.current.add(evt.id);
        trackCoachToolEvent(evt);
        if (MUTATION_TOOLS.has(evt.name)) mutated = true;
        // Per-bucket conclusion signals — gate the once-per-day skip. Once per session.
        if (onEvening && EVENING_DONE_TOOLS.has(evt.name) && !eveningDoneEmittedRef.current) {
          eveningDoneEmittedRef.current = true;
          logEvent('checkin_completed', { type: 'evening', via: evt.name }, screenId);
        }
        if (onMorning && MORNING_DONE_TOOLS.has(evt.name) && !morningDoneEmittedRef.current) {
          morningDoneEmittedRef.current = true;
          logEvent('checkin_completed', { type: 'morning', via: evt.name }, screenId);
        }
        const created = extractCreatedItem(evt);
        if (created) newlyCreated = created;
      }
    }
    if (newlyCreated) setLastCreatedItem(newlyCreated);
    if (!mutated) return;

    qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
    qc.invalidateQueries({ queryKey: queryKeys.entries.all });
    qc.invalidateQueries({ queryKey: queryKeys.habits.all });
    qc.invalidateQueries({ queryKey: queryKeys.checkins.all });
    qc.invalidateQueries({ queryKey: queryKeys.journal.all });
    qc.invalidateQueries({ queryKey: queryKeys.focusSessions.all });
    // Non-React-Query consumers (HabitsSection / useHabitsForDate) listen for this.
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }, [messages, qc, screenId, logEvent]);

  return lastCreatedItem;
}
