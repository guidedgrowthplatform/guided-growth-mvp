import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenRouteEntry } from '@/api/context';
import type { OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import { toolEventToVoiceActions } from '@/lib/onboarding/toolEventToVoiceActions';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@shared/types';
import type { LLMToolEvent } from '@shared/types/llm';

interface UseChatToolEventsArgs {
  toolEvents: LLMToolEvent[];
  active: boolean;
  routes: ScreenRouteEntry[] | undefined;
  // Synthetic submit_* actions → page reactions (radio updates, etc).
  onVoiceAction: (result: OnboardingVoiceResult) => void;
  // confirm_step_complete with advance=true → schedule the page advance.
  onAdvance: () => void;
  // Reset the fired-event dedup when this changes (screen change).
  resetKey: string | null;
}

// Routes streamed LLM tool calls to navigation, cache writes, page voice
// actions, and step advance. Split out of useOnboardingChat for testability.
export function useChatToolEvents({
  toolEvents,
  active,
  routes,
  onVoiceAction,
  onAdvance,
  resetKey,
}: UseChatToolEventsArgs): void {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const firedIdsRef = useRef<Set<string>>(new Set());

  // Reset dedup on screen change (declared before the dispatch effect so it
  // clears first in the same commit).
  useEffect(() => {
    firedIdsRef.current = new Set();
  }, [resetKey]);

  useEffect(() => {
    if (!active) return;
    let confirmAdvance = false;
    for (const evt of toolEvents) {
      if (!evt.result?.ok) continue;
      if (firedIdsRef.current.has(evt.id)) continue;
      firedIdsRef.current.add(evt.id);
      switch (evt.name) {
        case 'navigate_next': {
          const target = (evt.args as { target_screen?: unknown }).target_screen;
          if (typeof target !== 'string') break;
          const route = routes?.find((r) => r.screen_id === target)?.route;
          if (route) navigate(route);
          else console.warn('[onboarding] navigate_next: unknown target_screen', target);
          break;
        }
        case 'update_profile': {
          void qc.invalidateQueries({ queryKey: queryKeys.onboarding.state });
          break;
        }
        case 'confirm_step_complete': {
          const cp = evt.result?.payload as { result?: { advance?: boolean } } | undefined;
          if (cp?.result?.advance === true) confirmAdvance = true;
          break;
        }
        default: {
          const synthetic = toolEventToVoiceActions(evt);
          if (synthetic.length === 0) break;
          for (const r of synthetic) onVoiceAction(r);
          mergeOnboardingState(qc, evt);
          break;
        }
      }
    }
    if (confirmAdvance) onAdvance();
  }, [active, toolEvents, navigate, qc, routes, onVoiceAction, onAdvance]);
}

// Optimistic merge of a submit_* handler result into the cached onboarding
// state — keeps prev.updated_at so the authoritative Realtime row wins later.
function mergeOnboardingState(qc: ReturnType<typeof useQueryClient>, evt: LLMToolEvent): void {
  const payload = evt.result?.payload as
    | { ok?: boolean; result?: Record<string, unknown> }
    | undefined;
  if (!payload?.ok || !payload.result) return;
  qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) => {
    if (!prev) return prev;
    const result = payload.result as Record<string, unknown>;
    const handlerData = (result.data as Record<string, unknown> | undefined) ?? {};
    const handlerStep =
      typeof result.current_step === 'number' ? result.current_step : prev.current_step;
    const nextPath =
      typeof result.path === 'string' ? (result.path as OnboardingState['path']) : prev.path;
    return {
      ...prev,
      data: { ...prev.data, ...handlerData },
      current_step: Math.max(prev.current_step, handlerStep),
      path: nextPath,
    };
  });
}
