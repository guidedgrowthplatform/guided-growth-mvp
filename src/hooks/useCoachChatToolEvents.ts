import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '@/lib/query';
import type { LLMChatMessage } from '@gg/shared/types/llm';

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
]);

function toolEventIds(messages: LLMChatMessage[]): string[] {
  const ids: string[] = [];
  for (const m of messages) {
    for (const evt of m.toolEvents ?? []) ids.push(evt.id);
  }
  return ids;
}

// Mirrors useChatToolEvents' dedup kernel, but invalidates tracking caches
// instead of routing onboarding nav/state. Driven off the PERSISTED
// message.toolEvents (stable) — never llm.toolEvents (cleared on `done`).
export function useCoachChatToolEvents(
  messages: LLMChatMessage[],
  resetKey: string | null,
  initialMessages: LLMChatMessage[],
): void {
  const qc = useQueryClient();
  const firedIdsRef = useRef<Set<string>>(new Set());

  // Reset on session change; pre-seed with resumed-history ids so a
  // time-windowed resume doesn't re-invalidate old writes on mount.
  useEffect(() => {
    firedIdsRef.current = new Set(toolEventIds(initialMessages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    let mutated = false;
    for (const m of messages) {
      for (const evt of m.toolEvents ?? []) {
        if (!evt.result?.ok) continue;
        if (firedIdsRef.current.has(evt.id)) continue;
        firedIdsRef.current.add(evt.id);
        if (MUTATION_TOOLS.has(evt.name)) mutated = true;
      }
    }
    if (!mutated) return;

    qc.invalidateQueries({ queryKey: queryKeys.metrics.all });
    qc.invalidateQueries({ queryKey: queryKeys.entries.all });
    qc.invalidateQueries({ queryKey: queryKeys.habits.all });
    qc.invalidateQueries({ queryKey: queryKeys.checkins.all });
    qc.invalidateQueries({ queryKey: queryKeys.journal.all });
    qc.invalidateQueries({ queryKey: queryKeys.focusSessions.all });
    // Non-React-Query consumers (HabitsSection / useHabitsForDate) listen for this.
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }, [messages, qc]);
}
