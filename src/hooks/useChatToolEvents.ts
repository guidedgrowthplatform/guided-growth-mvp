import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenRouteEntry } from '@/api/context';
import type { OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import {
  BEAT_COMPLETING_TOOL_SCREEN,
  BEAT_COMPLETING_TOOLS,
  stepForScreenId,
} from '@/lib/onboarding/onboardingStepBeats';
import { STATIC_FEED_MODE } from '@/lib/onboarding/staticFeed';
import { toolEventToVoiceActions } from '@/lib/onboarding/toolEventToVoiceActions';
import { queryKeys } from '@/lib/query';
import type { OnboardingState } from '@gg/shared/types';
import type { LLMToolEvent } from '@gg/shared/types/llm';

interface UseChatToolEventsArgs {
  toolEvents: LLMToolEvent[];
  active: boolean;
  routes: ScreenRouteEntry[] | undefined;
  // Synthetic submit_* actions → page reactions (radio updates, etc).
  onVoiceAction: (result: OnboardingVoiceResult) => void;
  onWillAdvance?: () => void;
  // Reset the fired-event dedup when this changes (screen change).
  resetKey: string | null;
  // The active beat's screen_id — used to derive the advance target so a
  // beat-completing tool advances to THIS beat's step + 1 (idempotent with an
  // optimistic card-tap advance), not blindly current+1 (which skips a beat).
  screenId?: string | null;
  // Single-screen chat page: navigate_next bumps current_step in place instead
  // of react-router navigating to the (retired) routed step page.
  chatNative?: boolean;
}

// Routes streamed LLM tool calls to navigation, cache writes, page voice
// actions, and step advance. Split out of useOnboardingChat for testability.
export function useChatToolEvents({
  toolEvents,
  active,
  routes,
  onVoiceAction,
  onWillAdvance,
  resetKey,
  screenId,
  chatNative,
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
    if (STATIC_FEED_MODE && chatNative) return;
    if (!active) return;
    let willAdvance = false;
    for (const evt of toolEvents) {
      if (import.meta.env.DEV) {
        console.debug('[tool-dispatch] evt', {
          name: evt.name,
          ok: evt.result?.ok,
          fired: firedIdsRef.current.has(evt.id),
          active,
          chatNative,
          args: evt.args,
        });
      }
      if (!evt.result?.ok) continue;
      if (firedIdsRef.current.has(evt.id)) continue;
      firedIdsRef.current.add(evt.id);
      switch (evt.name) {
        case 'navigate_next': {
          const target = (evt.args as { target_screen?: unknown }).target_screen;
          if (typeof target !== 'string') break;
          if (chatNative) {
            // Single screen — advance the beat in place; beatForStep(path)
            // resolves the fork. Idempotent set (Math.max) via the inverse map.
            const mapped = stepForScreenId(target);
            if (mapped === undefined) {
              console.warn('[onboarding] navigate_next: unmapped target_screen', target);
            }
            qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) => {
              if (!prev) return prev;
              const targetStep = mapped ?? prev.current_step + 1;
              return { ...prev, current_step: Math.max(prev.current_step, targetStep) };
            });
            willAdvance = true;
            break;
          }
          const route = routes?.find((r) => r.screen_id === target)?.route;
          if (route) {
            navigate(route);
            willAdvance = true;
          } else console.warn('[onboarding] navigate_next: unknown target_screen', target);
          break;
        }
        case 'update_profile': {
          void qc.invalidateQueries({ queryKey: queryKeys.onboarding.state });
          break;
        }
        case 'advance_step': {
          const payload = evt.result?.payload as
            | { ok?: boolean; result?: { current_step?: unknown } }
            | undefined;
          const step =
            payload?.ok && typeof payload.result?.current_step === 'number'
              ? payload.result.current_step
              : undefined;
          if (step !== undefined) {
            // Routed flow: bare set (not Math.max) — back-nav walk-forward can
            // lower the step, which useAgentNavigation's leading-edge detector
            // needs to re-fire. Chat-native has no useAgentNavigation and bumps
            // current_step optimistically AHEAD of the server via card taps, so a
            // bare set here would rewind the visible beat — clamp with Math.max.
            qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) =>
              prev
                ? { ...prev, current_step: chatNative ? Math.max(prev.current_step, step) : step }
                : prev,
            );
            willAdvance = true;
          }
          break;
        }
        default: {
          const synthetic = toolEventToVoiceActions(evt);
          if (synthetic.length === 0) break;
          for (const r of synthetic) onVoiceAction(r);
          const before = qc.getQueryData<OnboardingState | null>(
            queryKeys.onboarding.state,
          )?.current_step;
          mergeOnboardingState(qc, evt);
          // Chat-native: a beat-completing data tool (submit_profile, etc.) saved
          // its data but does NOT bump current_step server-side past the GREATEST
          // pin — and the model is unreliable about chaining advance_step, which
          // strands the user on a "saved, let's continue" line with no next beat.
          // Mirror the card-tap handlers: a successful save advances in place.
          //
          // Two rules learned the hard way (V3 non-monotonic persist steps):
          //  - fire only when the tool's OWN beat is still active — a tool racing
          //    in after a card tap already advanced must not push the NEXT beat
          //    forward with an empty capture;
          //  - climb strictly past the current step — the pre-fork saves pin
          //    current_step at 8 (GREATEST), so a fixed beat-scale target (fork 3,
          //    category 4, ...) sits below the pin and a clamped bump never fires
          //    (the post-fork dead-air after a voice answer).
          if (
            chatNative &&
            BEAT_COMPLETING_TOOLS.has(evt.name) &&
            (!screenId || BEAT_COMPLETING_TOOL_SCREEN[evt.name] === screenId)
          ) {
            const beatStep = screenId ? stepForScreenId(screenId) : undefined;
            qc.setQueryData<OnboardingState | null>(queryKeys.onboarding.state, (prev) => {
              if (!prev) return prev;
              const target = Math.max(
                prev.current_step + 1,
                beatStep !== undefined ? beatStep + 1 : 0,
              );
              return { ...prev, current_step: target };
            });
          }
          const after = qc.getQueryData<OnboardingState | null>(
            queryKeys.onboarding.state,
          )?.current_step;
          if (typeof before === 'number' && typeof after === 'number' && after > before) {
            willAdvance = true;
          }
          break;
        }
      }
    }
    if (willAdvance) onWillAdvance?.();
  }, [active, toolEvents, navigate, qc, routes, onVoiceAction, onWillAdvance, chatNative]);
}

// Optimistic merge of a submit_* handler result into the cached onboarding
// state — keeps prev.updated_at so the authoritative Realtime row wins later.
function mergeOnboardingState(qc: ReturnType<typeof useQueryClient>, evt: LLMToolEvent): void {
  const payload = evt.result?.payload as
    | { ok?: boolean; result?: Record<string, unknown> }
    | undefined;
  if (import.meta.env.DEV) {
    console.debug('[tool-dispatch] mergeOnboardingState', {
      name: evt.name,
      payloadOk: payload?.ok,
      result: payload?.result,
      prevExists: !!qc.getQueryData(queryKeys.onboarding.state),
    });
  }
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
